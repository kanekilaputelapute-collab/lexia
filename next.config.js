/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdfjs-dist est client-only, on l'exclut du bundle serveur
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      }
      config.externals = [...(config.externals || []), 'pdfjs-dist']
    }
 
    // Nécessaire pour que webpack accepte les fichiers .mjs de pdfjs
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: { fullySpecified: false },
    })
 
    return config
  },
}
 
module.exports = nextConfig
 