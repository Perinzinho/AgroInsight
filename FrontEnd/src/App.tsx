import PieChart from './feature/pieChart/pieChart'
import pestChart from './data/pestChart.json'
import fertilizationChart from './data/fertilizationChart.json'
import { toPieChartData as toPestPieChartData } from './feature/DTO/pestChartDTO'
import type { PestDetectionChartDTO } from './feature/DTO/pestChartDTO'
import { toPieChartData } from './feature/DTO/fertilizationChartDTO'
import type { FertilizationChartDTO } from './feature/DTO/fertilizationChartDTO'
import './App.css'

function App() {
  const chartData: PestDetectionChartDTO = pestChart
  const pestChartData = toPestPieChartData(chartData)
  const fertilizationData: FertilizationChartDTO = fertilizationChart
  const fertilizationChartData = toPieChartData(fertilizationData)

  return (
    <div style={{ width: '400px' }}>
      <div>
        {/*<PieChart
          title={chartData.title}
          subtitle={chartData.subtitle}
          unit={chartData.unit}
          items={pestChartData.items}
          colors={pestChartData.colors}
        />
      </div>
      <div>
        <PieChart
          title={fertilizationData.title}
          subtitle={fertilizationData.subtitle}
          unit={fertilizationData.unit}
          centerValue={fertilizationData.weightedAverage}
          centerLabel="média ponderada"
          footerText={`Total: ${fertilizationData.totalOperations} operações`}
          items={fertilizationChartData.items}
          colors={fertilizationChartData.colors}
        />*/}
      </div>
    </div>
  )
}

export default App