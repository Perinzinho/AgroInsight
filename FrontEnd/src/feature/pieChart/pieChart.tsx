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
  unit?: string;
  centerValue?: number;
  centerLabel?: string;
  footerText?: string;
}

const defaultColors = [
  '#38BDF8', 
  '#52B788', 
  '#0F766E', 
  '#0EA5E9', 
  '#E9C46A', 
  '#9D4EDD', 
  '#E76F51', 
  '#F4A261', 
  '#EF476F', 
  '#264653', 
];

const formatValue = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
) {
  let fontSize = maxFontSize;

  while (fontSize > minFontSize) {
    ctx.font = `bold ${fontSize}px sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 1;
  }

  return fontSize;
}

// Plugin que desenha o número + label no centro do donut
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

      const maxTextWidth = Math.max(80, chartArea.width * 0.7);
      const valueFontSize = fitText(ctx, value, maxTextWidth, 28, 18);
      const labelFontSize = fitText(ctx, label, maxTextWidth, 13, 9);
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
  centerValue,
  centerLabel = unit,
  footerText,
}: DonutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const total = items.reduce((soma, item) => soma + item.value, 0);
  const displayedCenterValue = centerValue ?? total;
  const chartColors = colors?.length ? colors : defaultColors;

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
            backgroundColor: chartColors,
            borderWidth: 0,
            hoverOffset: 6,
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
      plugins: [
        createCenterTextPlugin(
          displayedCenterValue.toLocaleString('pt-BR'),
          centerLabel,
        ),
      ],
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [items, chartColors, title, subtitle, unit, centerValue, centerLabel, total, displayedCenterValue]);

  return (
    <div
      style={{
        background: '#0B1414',
        borderRadius: '16px',
        padding: '20px',
        width: 'min(100%, 420px)',
        boxSizing: 'border-box',
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '8px',
          marginTop: '20px',
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              fontSize: '13px',
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                flex: '0 0 10px',
                backgroundColor: chartColors[index % chartColors.length],
                display: 'inline-block',
              }}
            />
            <span
              title={item.label}
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
            <strong style={{ flex: '0 0 auto', color: '#E7F0EC', fontSize: '12px' }}>
              {formatValue(item.value)}
            </strong>
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
        {footerText ?? `Total: ${formatValue(total)} ${unit}`}
      </div>
    </div>
  );
}