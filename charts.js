// ============================================================
// Detroit Data Intelligence Platform - Chart.js Visualizations
// ============================================================

// Register Chart.js dark theme defaults
Chart.defaults.color = '#cccccc';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.color = '#cccccc';
Chart.defaults.plugins.title.color = '#ffffff';
Chart.defaults.plugins.title.font = { size: 14, weight: 'bold' };
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.85)';
Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
Chart.defaults.plugins.tooltip.bodyColor = '#cccccc';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.2)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.scale.grid = {
  color: 'rgba(255, 255, 255, 0.08)',
  drawBorder: false
};
Chart.defaults.scale.ticks = {
  color: '#999999'
};

// Active chart instances for cleanup
const chartInstances = {};

// Destroy an existing chart by key before creating a new one
function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

// Color palette for charts
const CHART_PALETTE = [
  '#e94560', '#00d2ff', '#ffd700', '#00ff88',
  '#ff6b35', '#66ccff', '#ff00ff', '#ff3333',
  '#88ff88', '#ffaa00', '#aa66ff', '#ff6699'
];

// ----------------------------------------------------------------
// Neighborhood Momentum Chart
// Horizontal bar chart of top 20 neighborhoods by momentum score
// ----------------------------------------------------------------
function createNeighborhoodMomentumChart(data) {
  const canvas = document.getElementById('momentum-chart');
  if (!canvas) return;

  destroyChart('momentum');

  // Sort by momentum score and take top 20
  const sorted = [...data]
    .filter(n => n.momentum_score != null)
    .sort((a, b) => b.momentum_score - a.momentum_score)
    .slice(0, 20);

  if (sorted.length === 0) return;

  const labels = sorted.map(n => n.name || 'Unknown');
  const scores = sorted.map(n => n.momentum_score);
  const colors = scores.map(s => {
    if (s > 5) return '#00ff88';
    if (s > 2) return '#66ccff';
    if (s > 0) return '#ffd700';
    if (s > -2) return '#ff6b35';
    return '#e94560';
  });

  chartInstances['momentum'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Momentum Score',
        data: scores,
        backgroundColor: colors,
        borderColor: colors.map(c => c),
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Top 20 Neighborhoods by Momentum Score',
          padding: { bottom: 15 }
        },
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return 'Score: ' + ctx.parsed.x.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Momentum Score'
          }
        },
        y: {
          ticks: {
            font: { size: 11 }
          }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// Neighborhood Comparison Chart
// Multi-axis chart comparing 2-3 selected neighborhoods
// ----------------------------------------------------------------
function createComparisonChart(neighborhoods) {
  const canvas = document.getElementById('comparison-chart');
  if (!canvas) return;

  destroyChart('comparison');

  if (!neighborhoods || neighborhoods.length < 2) return;

  const labels = ['Sales Volume', 'Avg Price ($K)', 'Permits', 'Momentum', 'Price Trend (%)', 'Vacancy Rate (%)'];

  const datasets = neighborhoods.map((n, i) => {
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    return {
      label: n.name || 'Unknown',
      data: [
        n.total_sales || 0,
        (n.avg_price || 0) / 1000,  // convert to thousands
        n.total_permits || 0,
        n.momentum_score || 0,
        n.price_trend_pct || 0,
        n.vacancy_rate || 0
      ],
      backgroundColor: color + '55',
      borderColor: color,
      borderWidth: 2,
      pointBackgroundColor: color,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1,
      pointRadius: 5
    };
  });

  chartInstances['comparison'] = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Neighborhood Comparison',
          padding: { bottom: 15 }
        },
        legend: {
          position: 'top'
        }
      },
      scales: {
        r: {
          angleLines: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.08)'
          },
          pointLabels: {
            color: '#cccccc',
            font: { size: 11 }
          },
          ticks: {
            backdropColor: 'transparent',
            color: '#999999'
          },
          suggestedMin: 0
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// Investor Timeline Chart
// Line chart showing investor purchases over time
// ----------------------------------------------------------------
function createInvestorTimelineChart(timeline) {
  const canvas = document.getElementById('investor-timeline-chart');
  if (!canvas) return;

  destroyChart('investorTimeline');

  if (!timeline || timeline.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#999999';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No timeline data available.', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Sort timeline by date
  const sorted = [...timeline].sort((a, b) => {
    const da = new Date(a.date || a.sale_date);
    const db = new Date(b.date || b.sale_date);
    return da - db;
  });

  // Build cumulative data
  const labels = [];
  const cumulativeCount = [];
  const cumulativeSpend = [];
  const individualPrices = [];
  let totalCount = 0;
  let totalSpend = 0;

  sorted.forEach(item => {
    const dateStr = formatDate(item.date || item.sale_date);
    labels.push(dateStr);
    totalCount += 1;
    totalSpend += Number(item.price || 0);
    cumulativeCount.push(totalCount);
    cumulativeSpend.push(totalSpend);
    individualPrices.push(Number(item.price || 0));
  });

  chartInstances['investorTimeline'] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Cumulative Purchases',
          data: cumulativeCount,
          borderColor: '#00d2ff',
          backgroundColor: '#00d2ff33',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          yAxisID: 'y',
          pointRadius: 3,
          pointBackgroundColor: '#00d2ff'
        },
        {
          label: 'Cumulative Spend ($)',
          data: cumulativeSpend,
          borderColor: '#ffd700',
          backgroundColor: '#ffd70033',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          yAxisID: 'y1',
          pointRadius: 3,
          pointBackgroundColor: '#ffd700'
        },
        {
          label: 'Individual Purchase Price ($)',
          data: individualPrices,
          borderColor: '#e9456066',
          backgroundColor: '#e94560',
          borderWidth: 0,
          type: 'bar',
          yAxisID: 'y1',
          barPercentage: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: 'Purchase Timeline',
          padding: { bottom: 15 }
        },
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (ctx.dataset.yAxisID === 'y1' || ctx.dataset.label.includes('Spend') || ctx.dataset.label.includes('Price')) {
                return ctx.dataset.label + ': ' + formatMoney(ctx.parsed.y);
              }
              return ctx.dataset.label + ': ' + ctx.parsed.y;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            maxTicksLimit: 20,
            font: { size: 10 }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Total Purchases'
          },
          beginAtZero: true
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Amount ($)'
          },
          beginAtZero: true,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: function (value) {
              if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
              return '$' + value;
            }
          }
        }
      }
    }
  });
}

// ----------------------------------------------------------------
// Utility: Create a simple stat sparkline (mini chart)
// ----------------------------------------------------------------
function createSparkline(canvas, data, color) {
  if (!canvas || !data || data.length === 0) return;

  destroyChart('spark_' + canvas.id);

  chartInstances['spark_' + canvas.id] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data: data,
        borderColor: color || '#00d2ff',
        backgroundColor: (color || '#00d2ff') + '22',
        borderWidth: 1.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      elements: {
        line: { borderWidth: 1.5 }
      }
    }
  });
}
