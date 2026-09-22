import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  import './App.css'

  const messages = {
    soil: 'O solo mostra sinais de compactacao. Uma janela de manejo pode recuperar o potencial da proxima safra.',
    water: 'A umidade esta abaixo do ideal no talhao norte. Ajustar a irrigacao hoje pode proteger o rendimento.',
    climate: 'As ultimas chuvas vieram irregulares. Vale revisar a previsao antes de definir o proximo manejo.',
    nutrients: 'O balanco nutricional pede atencao. Priorize a analise do solo antes de aplicar novos insumos.',
    planning: 'O melhor resultado nasce de pequenas decisoes no momento certo. Confira os indicadores da sua lavoura.',
  } as const

  const messageList = Object.values(messages)

  const fields = [
    { label: 'Talhao Norte', value: '87%', meta: 'desenvolvimento', tone: 'green', icon: '↗' },
    { label: 'Umidade do solo', value: '42%', meta: '2% abaixo do ideal', tone: 'blue', icon: '◌' },
    { label: 'Previsao de chuva', value: '18 mm', meta: 'nos proximos 7 dias', tone: 'yellow', icon: '☼' },
    { label: 'Talhao Leste', value: '64%', meta: 'desenvolvimento', tone: 'green', icon: '↗' },
    { label: 'Temperatura', value: '27 °C', meta: 'agora na propriedade', tone: 'orange', icon: '°' },
    { label: 'Atencao recomendada', value: '03', meta: 'indicadores para revisar', tone: 'red', icon: '!' },
  ]

  const pickMessage = () => messageList[Math.floor(Math.random() * messageList.length)]

  function App() {
    const message = pickMessage()

    return (
      <main className="dashboard-shell">
        <header className="topbar">
          <a className="brand" href="#overview" aria-label="AgroInsight inicio">
            <span className="brand-mark">✳</span>
            <span>Agro<span>Insight</span></span>
          </a>
          <nav aria-label="Navegacao principal">
            <a className="active" href="#overview">Visao geral</a>
            <a href="#fields">Talhoes</a>
            <a href="#insights">Insights</a>
          </nav>
          <button className="profile-button" type="button" aria-label="Abrir perfil de Lucas Almeida">LA</button>
        </header>

        <section className="hero-section" id="overview">
          <div className="hero-copy">
            <p className="eyebrow"><span></span> Bom dia, Lucas</p>
            <h1>Por que a lavoura <em>nao esta rendendo?</em></h1>
            <p className="hero-message">{message}</p>
            <div className="hero-actions">
              <a className="primary-action" href="#insights">Ver insights <span>→</span></a>
              <p><span className="live-dot"></span> Dados atualizados ha 8 min</p>
            </div>
          </div>
          <div className="field-illustration" aria-label="Ilustracao dos talhoes da propriedade" role="img">
            <div className="sun"></div><div className="horizon"></div>
            <div className="field-lines line-one"></div><div className="field-lines line-two"></div><div className="field-lines line-three"></div>
            <div className="field-label label-one"><strong>Talhao Norte</strong><span>87% saudavel</span></div>
            <div className="field-label label-two"><strong>Talhao Leste</strong><span>64% saudavel</span></div>
          </div>
        </section>

        <section className="section-heading" id="fields">
          <div><p className="eyebrow"><span></span> Monitoramento</p><h2>O que esta acontecendo agora</h2></div>
          <button className="filter-button" type="button">Ultimos 7 dias <span>⌄</span></button>
        </section>

        <section className="metrics-grid" aria-label="Indicadores da lavoura">
          {fields.map((field) => (
            <article className={`metric-card ${field.tone}`} key={field.label}>
              <div className="metric-top"><span className="metric-icon">{field.icon}</span><span className="metric-arrow">↗</span></div>
              <p>{field.label}</p><strong>{field.value}</strong><small>{field.meta}</small>
            </article>
          ))}
        </section>

        <section className="insights-section" id="insights">
          <div><p className="eyebrow"><span></span> Leitura da semana</p><h2>Um olhar mais atento muda a proxima decisao.</h2></div>
          <p className="insight-copy">Cruze clima, solo e desenvolvimento para encontrar o ponto que pede sua atencao antes que ele apareca no resultado.</p>
          <a className="text-action" href="#fields">Explorar analise <span>→</span></a>
        </section>
        <footer><span>AgroInsight</span><span>Safra 2024/25 · Fazenda Horizonte</span></footer>
      </main>
    )
  }

  export default App
}

export default App
