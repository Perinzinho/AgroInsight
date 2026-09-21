import './Header.css'
import exportarPDF from '../../feature/ExportPDF'

export default function Header(){
  return(
    <div id="relatorio">
    <header className="header">
        <div className="header-content">
            <h1>Agroinsight!</h1>
            <button type="button" onClick={exportarPDF}>
              Export PDF
            </button>
        </div>
    </header>
    </div>
  )  
}

