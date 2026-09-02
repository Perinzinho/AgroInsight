import { AlertsList } from './feature/alerts/AlertsList'
import alertsData from './data/alerts.example.json'
import recommendationsData from './data/recommendations.example.json'
import { RecommendationsSection, type RecommendationsData } from './feature/recommendations/RecommendationsSection'
import './App.css'

function App() {
  return (
    <main className="app">
      <AlertsList data={alertsData} />
      <RecommendationsSection data={recommendationsData as RecommendationsData} />
    </main>
  )
}

export default App
