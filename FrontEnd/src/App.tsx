import { AlertsList } from './feature/alerts/AlertsList'
import alertsData from './data/alerts.example.json'
import './App.css'

function App() {
  return <main className="app"><AlertsList data={alertsData} /></main>
}

export default App
