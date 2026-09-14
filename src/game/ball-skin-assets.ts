// Vite只生成本地URL目录，图片在实际使用时才请求，不创建预览WebGL。
const assets=import.meta.glob<string>('../assets/ball-skins/*.png',{eager:true,query:'?url',import:'default'})
export function ballSkinAsset(file:string) { return assets[`../assets/ball-skins/${file}`] }
