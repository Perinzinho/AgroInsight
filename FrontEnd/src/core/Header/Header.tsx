import './Header.css'
import exportarPDF from '../../feature/ExportPDF'

export default function Header(){
  return(
    <div id="relatorio">
    <header className="header">
        <div className="header-content">
            <h1 className="header-logo">
              AgroInsight <span className="header-logo-version">4.0</span>
            </h1>
            <button type="button" className="header-export-btn" onClick={exportarPDF}>
              Exportar relatório PDF
            </button>
        </div>
    </header>
    </div>
  )  
}
