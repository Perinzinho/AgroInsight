import { loadConfig } from './config'
import { createAiServer } from './http'

try {
  const config = loadConfig()
  const server = createAiServer(config)
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(error.code === 'EADDRINUSE' ? `A porta ${config.AI_PORT} está ocupada. Configure AI_PORT; nenhum processo foi encerrado.` : 'Não foi possível iniciar a API local. Verifique host e porta.')
    process.exitCode = 1
  })
  server.listen(config.AI_PORT, config.AI_HOST, () => console.info(`API AgroInsight: http://${config.AI_HOST}:${config.AI_PORT}`))
} catch {
  console.error('Configuração inválida da API. Confira as variáveis de .env e os limites documentados.')
  process.exitCode = 1
}
