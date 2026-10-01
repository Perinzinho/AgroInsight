import AgroProvider from './data/AgroProvider'
import Shell from './feature/shell/shell'
import './App.css'

/**
 * Raiz do produto: provider de dados + shell.
 *
 * Todo o resto da interface vive dentro do `AgroProvider`, porque as telas leem
 * o mesmo pacote de dados e os mesmos filtros globais. Nao ha estado de dado
 * duplicado em componente.
 */
export default function App() {
  return (
    <AgroProvider>
      <Shell />
    </AgroProvider>
  )
}