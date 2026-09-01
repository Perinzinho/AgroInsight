import PieChart from './feature/pieChart/pieChart'
import culturas from './data/culturas.json'
import './App.css'

function App() {
  return (
    <div style={{ width: '400px' }}>
      <div>
      <PieChart
        title="Insetos capturados por espécie"
        subtitle="Distribuição por espécie (26/01 a 25/02)"
        unit="insetos" 
        items={[...culturas]}
      />
      </div>
      <div>
        <PieChart
        title="Insetos capturados por espécie"
        subtitle="Distribuição por espécie (26/01 a 25/02)"
        unit="insetos"  
        items={[...culturas]}
      />
      </div>
    </div>
  )
}

export default App