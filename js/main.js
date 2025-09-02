// Conversor USD → BRL
const taxaCambio = 5.25;
function converter() {
    let valor = parseFloat(document.getElementById('valor').value) || 0;
    document.getElementById('resultado').innerText = (valor * taxaCambio).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Calculadora de juros simples
function calcular() {
    let P = parseFloat(document.getElementById('principal').value) || 0;
    let i = parseFloat(document.getElementById('taxa').value) / 100 || 0;
    let n = parseFloat(document.getElementById('meses').value) || 0;
    let M = P * (1 + i * n);
    document.getElementById('montante').innerText = M.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Cotação em tempo real - CoinGecko (BTC e ETH)
async function obterCotacaoCripto(id) {
    const resposta = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=brl`);
    const dados = await resposta.json();
    return dados[id].brl;
}

// Cotação de ação - brapi (ex: ITUB4)
async function obterCotacaoAcao(codigo) {
    const resposta = await fetch(`https://brapi.dev/api/quote/${codigo}`);
    const dados = await resposta.json();
    return dados.results[0].regularMarketPrice;
}

// Arrays para histórico de gráfico
let historicoBTC = [];
let historicoETH = [];
let historicoITUB4 = [];
let labels = [];

// Inicializa gráfico Chart.js
const ctx = document.getElementById('graficoCotacoes').getContext('2d');
const grafico = new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [
            { label: 'Bitcoin (BTC)', data: historicoBTC, borderColor: 'orange', fill: false },
            { label: 'Ethereum (ETH)', data: historicoETH, borderColor: 'purple', fill: false },
            { label: 'ITUB4', data: historicoITUB4, borderColor: 'green', fill: false }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: false }
        }
    }
});

// Atualiza cotações e gráfico
async function atualizarCotacoes() {
    const btc = await obterCotacaoCripto('bitcoin');
    const eth = await obterCotacaoCripto('ethereum');
    const itub4 = await obterCotacaoAcao('ITUB4');

    document.getElementById('btc').innerText = btc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('eth').innerText = eth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('acao').innerText = itub4.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const horario = new Date().toLocaleTimeString();
    labels.push(horario);
    historicoBTC.push(btc);
    historicoETH.push(eth);
    historicoITUB4.push(itub4);

    if (labels.length > 20) {
        labels.shift();
        historicoBTC.shift();
        historicoETH.shift();
        historicoITUB4.shift();
    }

    grafico.update();
}

// Atualiza imediatamente e a cada 60 segundos
atualizarCotacoes();
setInterval(atualizarCotacoes, 60000);


// Função para obter histórico de BTC ou ETH
async function obterHistoricoCripto(id, dias) {
    const resposta = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=brl&days=${dias}`);
    const dados = await resposta.json();
    // Retorna arrays de timestamps e preços
    return dados.prices.map(p => ({ x: new Date(p[0]), y: p[1] }));
}

// Função para obter histórico da ação ITUB4
async function obterHistoricoAcao(codigo, dias) {
    const resposta = await fetch(`https://brapi.dev/api/quote/${codigo}?range=${dias}`);
    const dados = await resposta.json();
    // Retorna array de {x: data, y: preço}
    return dados.results[0].historical.map(p => ({ x: new Date(p.date), y: p.close }));
}

// Atualiza gráfico por período
async function atualizarGrafico(periodo) {
    let dias;
    switch(periodo) {
        case 'today': dias = 1; break;
        case '24h': dias = 1; break;
        case '7d': dias = 7; break;
        case '1m': dias = 30; break;
        case '6m': dias = 180; break;
        default: dias = 1;
    }

    const btcData = await obterHistoricoCripto('bitcoin', dias);
    const ethData = await obterHistoricoCripto('ethereum', dias);
    const itub4Data = await obterHistoricoAcao('ITUB4', dias);

    grafico.data.datasets[0].data = btcData;
    grafico.data.datasets[1].data = ethData;
    grafico.data.datasets[2].data = itub4Data;

    grafico.data.labels = btcData.map(p => p.x.toLocaleString());
    grafico.update();
}

// Inicializa gráfico com "Hoje"
atualizarGrafico('today');
