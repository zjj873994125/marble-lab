import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('自动部署使用固定镜像、严格 SSH 校验；拉取或健康失败不记录成功版本', t => {
  const root = mkdtempSync(join(tmpdir(), 'marble-deploy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const bin = join(root, 'bin')
  mkdirSync(bin)
  // SSH、SCP 和 Docker 均为本地替身；执行真实部署脚本的控制流，不连接服务器。
  const commands = {
    ssh: 'printf "ssh %s\\n" "$*" >> "$DEPLOY_TEST_LOG"\nbash -c "${!#}"',
    scp: 'args=("$@")\nsource="${args[$#-2]}"\ndest="${!#}"\ncp -- "$source" "${dest#*:}"',
    docker: 'printf "docker %s\\n" "$*" >> "$DEPLOY_TEST_LOG"\ncase " $* " in\n  *" pull "*) [[ "$DEPLOY_TEST_FAIL" != pull ]] || exit 42 ;;\n  *" up "*) [[ "$DEPLOY_TEST_FAIL" != health ]] || exit 43 ;;\nesac',
  }
  for (const [name, script] of Object.entries(commands)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\nset -eu\n${script}\n`, { mode: 0o700 })
  }

  const image = `ghcr.io/zjj873994125/marble-lab:sha-${'a'.repeat(40)}`
  for (const failure of ['none', 'pull', 'health', 'missing-key', 'invalid-path']) {
    const directory = join(root, failure)
    mkdirSync(directory)
    const release = join(directory, 'release.env')
    writeFileSync(release, 'MARBLE_IMAGE=previous\n')
    writeFileSync(join(directory, 'compose.yaml'), 'previous-compose\n')
    const log = join(directory, 'commands.log')
    const env = {
      ...process.env, PATH: `${bin}:${process.env.PATH}`,
      DEPLOY_HOST: 'example.test', DEPLOY_USER: 'root', DEPLOY_PORT: '2222',
      DEPLOY_PATH: failure === 'invalid-path' ? `${directory};false` : directory,
      DEPLOY_SSH_KEY: failure === 'missing-key' ? '' : 'test-private-key-not-real',
      DEPLOY_KNOWN_HOSTS: 'test-host-key-not-real', MARBLE_IMAGE: image,
      DEPLOY_TEST_LOG: log, DEPLOY_TEST_FAIL: failure,
    }
    const result = spawnSync('bash', ['deploy/deploy.sh'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), env, encoding: 'utf8', timeout: 10000,
    })
    assert.ifError(result.error)
    assert.equal(result.status === 0, failure === 'none', result.stderr)
    const calls = existsSync(log) ? readFileSync(log, 'utf8') : ''
    if (['missing-key', 'invalid-path'].includes(failure)) {
      assert.equal(calls, '')
    } else {
      assert.match(calls, /StrictHostKeyChecking=yes/)
      assert.match(calls, /-p 2222 root@example\.test/)
      assert.match(calls, new RegExp(`sha-${'a'.repeat(40)}`))
      if (failure === 'pull') assert.doesNotMatch(calls, / up /)
      else assert.match(calls, /up -d --wait --wait-timeout 120 marble-lab/)
    }
    assert.equal(readFileSync(release, 'utf8'), failure === 'none' ? `MARBLE_IMAGE=${image}\n` : 'MARBLE_IMAGE=previous\n')
    if (failure !== 'none') assert.equal(readFileSync(join(directory, 'compose.yaml'), 'utf8'), 'previous-compose\n')
    assert.doesNotMatch(`${calls}${result.stdout}${result.stderr}`, /test-private-key-not-real/)
  }
})
