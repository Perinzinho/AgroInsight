import { useEffect, useRef } from 'react';
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  SubTitle,
} from 'chart.js';
import type { Plugin } from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend, Title, SubTitle);

interface ChartItem {
  label: string;
  value: number;
}

interface DonutChartProps {
  items: ChartItem[];
  colors?: string[];
  title?: string;
  subtitle?: string;
  unit?: string; // texto abaixo do número central e no total (ex: "insetos")
}

const defaultColors = [
  '#38BDF8', 
  '#52B788', 
  '#0F766E', 
  '#0EA5E9', 
  '#E9C46A', 
];

// 👉 Plugin que desenha o número + label no centro do donut
function createCenterTextPlugin(value: string, label: string): Plugin<'doughnut'> {
  return {
    id: 'centerText',
    afterDraw: (chart) => {
      const { ctx, chartArea } = chart;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const valueFontSize = 28;
      const labelFontSize = 13;
      const gap = 4; // espaço entre as duas linhas

      // Calcula a altura total do bloco de texto (as duas linhas juntas)
      const totalHeight = valueFontSize + gap + labelFontSize;

      // Posição Y do topo do bloco, para que ele fique centralizado
      const startY = centerY - totalHeight / 2;

      // Linha 1: número grande
      ctx.font = `bold ${valueFontSize}px sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(value, centerX, startY + valueFontSize / 2);

      // Linha 2: texto pequeno
      ctx.font = `${labelFontSize}px sans-serif`;
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(label, centerX, startY + valueFontSize + gap + labelFontSize / 2);

      ctx.restore();
    },
  };
}

export default function PieChart({
  items,
  colors,
  title,
  subtitle,
  unit = '',
}: DonutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const total = items.reduce((soma, item) => soma + item.value, 0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const labels = items.map((item) => item.label);
    const data = items.map((item) => item.value);

    // Plugins customizados dependem da config inicial,
    // então aqui é melhor sempre destruir e recriar
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors ?? defaultColors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            display: false, //  legenda customizada em HTML embaixo (mais fácil de estilizar em 2 colunas)
          },
          title: {
            display: !!title,
            text: title ?? '',
            font: { size: 18, weight: 'bold' },
            color: '#E7F0EC',
            align: 'start',
            padding: { bottom: 4 },
          },
          subtitle: {
            display: !!subtitle,
            text: subtitle ?? '',
            font: { size: 13 },
            color: '#8FA79E',
            align: 'start',
            padding: { bottom: 20 },
          },
        },
      },
      plugins: [createCenterTextPlugin(total.toLocaleString('pt-BR'), unit)],
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [items, colors, title, subtitle, unit, total]);

  return (
    <div
      style={{
        background: '#0B1414',
        borderRadius: '16px',
        padding: '20px',
        width: '280px',
        color: '#E7F0EC',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Área do gráfico */}
      <div style={{ width: '100%', height: '220px' }}>
        <canvas ref={canvasRef}></canvas>
      </div>

      {/* Legenda customizada em grid 2 colunas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginTop: '20px',
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: (colors ?? defaultColors)[index % (colors ?? defaultColors).length],
                display: 'inline-block',
              }}
            />
            {item.label}
          </div>
        ))}
      </div>

      {/* Total embaixo */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: '12px',
          color: '#8FA79E',
        }}
      >
        Total: {total.toLocaleString('pt-BR')} {unit}
      </div>
    </div>
  );
}