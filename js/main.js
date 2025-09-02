// --- CONFIGURAÇÕES E ESTADO GLOBAL ---
const TAXA_CAMBIO_USD_BRL = 5.25;
const LISTA_CRIPTO_IDS = ['bitcoin', 'ethereum', 'tether', 'solana', 'bnb', 'xrp', 'cardano', 'dogecoin', 'tron', 'avalanche-2'];
const LISTA_ACOES_TICKERS = ['ITUB4', 'PETR4', 'VALE3', 'MGLU3'];

let selectedCurrency = 'brl'; // 'brl' ou 'usd'
let selectedPeriod = '24h';   // '24h', '7d', etc.

// --- ELEMENTOS DO DOM ---
const cotacoesBody = document.getElementById('cotacoes-body');
const graficoCanvas = document.getElementById('graficoCotacoes').getContext('2d');
const periodSelector = document.getElementById('period-selector');
const currencySelector = document.querySelector('.currency-selector');
let grafico; // Variável para armazenar a instância do gráfico

// --- FUNÇÕES AUXILIARES ---
const formatarDinheiro = (valor, currency) => {
    const options = { style: 'currency', currency: currency.toUpperCase() };
    if (currency.toLowerCase() === 'usd') {
        return valor.toLocaleString('en-US', options);
    }
    return valor.toLocaleString('pt-BR', options);
};
const formatarPorcentagem = (valor) => (valor || 0).toFixed(2) + '%';
const getChangeClass = (valor) => (valor || 0) >= 0 ? 'positive' : 'negative';

// --- LÓGICA DE DADOS (APIs) ---

async function obterDadosCripto(currency) {
    const ids = LISTA_CRIPTO_IDS.join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d`;
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error(`API CoinGecko: ${resposta.statusText}`);
        return await resposta.json();
    } catch (error) {
        console.error("Falha ao buscar dados de criptomoedas:", error);
        return [];
    }
}

async function obterDadosAcoes() {
    if (LISTA_ACOES_TICKERS.length === 0) return [];
    const tickers = LISTA_ACOES_TICKERS.join(',');
    const url = `https://brapi.dev/api/quote/${tickers}`;
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error(`API Brapi: ${resposta.statusText}`);
        const dados = await resposta.json();
        return dados.results;
    } catch (error) {
        console.error("Falha ao buscar dados de ações:", error);
        return [];
    }
}

// --- LÓGICA DE RENDERIZAÇÃO ---

function renderizarTabela(criptos, acoes, currency) {
    let html = '';
    let rank = 1;

    // Renderiza criptos (em BRL ou USD, conforme selecionado)
    criptos.forEach(cripto => {
        const price = formatarDinheiro(cripto.current_price, currency);
        const change24h = cripto.price_change_percentage_24h_in_currency;
        const change7d = cripto.price_change_percentage_7d_in_currency;

        html += `
            <tr>
                <td>${rank++}</td>
                <td>
                    <div class="coin-name">
                        <img src="${cripto.image}" alt="${cripto.name}">
                        <span>${cripto.name} <span class="symbol">${cripto.symbol.toUpperCase()}</span></span>
                    </div>
                </td>
                <td>${price}</td>
                <td class="${getChangeClass(change24h)}">${formatarPorcentagem(change24h)}</td>
                <td class="${getChangeClass(change7d)}">${formatarPorcentagem(change7d)}</td>
            </tr>`;
    });

    // Renderiza ações (sempre em BRL)
    acoes.forEach(acao => {
        const price = formatarDinheiro(acao.regularMarketPrice, 'brl'); // Alterado para sempre usar 'brl'
        const change24h = acao.regularMarketChangePercent;

        html += `
            <tr>
                <td>-</td>
                <td>
                    <div class="coin-name">
                        <img src="${acao.logourl}" alt="${acao.longName}">
                        <span>${acao.longName} <span class="symbol">${acao.symbol}</span></span>
                    </div>
                </td>
                <td>${price}</td>
                <td class="${getChangeClass(change24h)}">${formatarPorcentagem(change24h)}</td>
                <td>-</td>
            </tr>`;
    });
    
    cotacoesBody.innerHTML = html;
}

// --- LÓGICA DO GRÁFICO ---

function inicializarGrafico() {
    grafico = new Chart(graficoCanvas, {
        type: 'line',
        data: { datasets: [
            { label: 'Bitcoin (BTC)', data: [], borderColor: 'orange', fill: false, pointRadius: 1 },
            { label: 'Ethereum (ETH)', data: [], borderColor: 'purple', fill: false, pointRadius: 1 },
            { label: 'ITUB4', data: [], borderColor: 'green', fill: false, pointRadius: 1 }
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: 'day', tooltipFormat: 'dd/MM/yyyy HH:mm' }, title: { display: true, text: 'Data' } },
                y: { beginAtZero: false, title: { display: true, text: 'Preço' } }
            }
        }
    });
}

async function obterHistorico(period, currency) {
    const periodos = { '24h': 1, '7d': 7, '1m': 30, '6m': 180, '1y': 365 };
    const days = periodos[period];

    // Histórico das criptos é buscado na moeda selecionada (BRL ou USD)
    const fetchCriptoHistory = async (id) => {
        const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${currency}&days=${days}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        return dados.prices.map(p => ({ x: p[0], y: p[1] }));
    };

    // Histórico das ações é buscado sempre em BRL e convertido se necessário
    const fetchAcaoHistory = async (ticker) => {
        let range = '1d';
        if (days > 7 && days <=30) range = '1mo';
        else if (days > 30 && days <= 180) range = '6mo';
        else if (days > 180) range = '1y';

        const url = `https://brapi.dev/api/quote/${ticker}?range=${range}&interval=1d`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        return dados.results[0].historicalDataPrice.map(p => ({ 
            x: p.date * 1000, 
            y: currency === 'usd' ? p.close / TAXA_CAMBIO_USD_BRL : p.close 
        }));
    };

    return Promise.all([
        fetchCriptoHistory('bitcoin'),
        fetchCriptoHistory('ethereum'),
        fetchAcaoHistory('ITUB4')
    ]);
}

async function atualizarGrafico() {
    try {
        const [btcData, ethData, itub4Data] = await obterHistorico(selectedPeriod, selectedCurrency);
        
        grafico.data.datasets[0].data = btcData;
        grafico.data.datasets[1].data = ethData;
        grafico.data.datasets[2].data = itub4Data;
        
        grafico.options.scales.x.time.unit = (selectedPeriod === '24h') ? 'hour' : 'day';
        grafico.options.scales.y.title.text = `Preço (${selectedCurrency.toUpperCase()})`;
        grafico.update();

    } catch(error) {
        console.error("Erro ao atualizar o gráfico:", error);
    }
}


// --- FUNÇÃO PRINCIPAL DE ATUALIZAÇÃO ---
async function atualizarTudo() {
    cotacoesBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Carregando...</td></tr>`;
    try {
        const [dadosCripto, dadosAcoes] = await Promise.all([
            obterDadosCripto(selectedCurrency),
            obterDadosAcoes()
        ]);
        renderizarTabela(dadosCripto, dadosAcoes, selectedCurrency);
        await atualizarGrafico();
    } catch (error) {
        console.error("Falha ao atualizar dados:", error);
        cotacoesBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Falha ao carregar dados. Tente novamente.</td></tr>`;
    }
}


// --- FUNÇÕES LEGADAS (Conversor e Calculadora) ---
function converter() {
    let valor = parseFloat(document.getElementById('valor').value) || 0;
    document.getElementById('resultado').innerText = formatarDinheiro(valor * TAXA_CAMBIO_USD_BRL, 'brl');
}

function calcular() {
    let P = parseFloat(document.getElementById('principal').value) || 0;
    let i = parseFloat(document.getElementById('taxa').value) / 100 || 0;
    let n = parseFloat(document.getElementById('meses').value) || 0;
    let M = P * (1 + i * n); // Juros Simples
    document.getElementById('montante').innerText = formatarDinheiro(M, 'brl');
}

// --- INICIALIZAÇÃO E EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    inicializarGrafico();
    atualizarTudo();

    setInterval(() => {
        obterDadosCripto(selectedCurrency)
            .then(criptos => obterDadosAcoes().then(acoes => renderizarTabela(criptos, acoes, selectedCurrency)))
            .catch(err => console.error("Falha na atualização automática da tabela:", err));
    }, 300000); // 5 minutos

    currencySelector.addEventListener('click', (event) => {
        if (event.target.tagName !== 'BUTTON' || event.target.classList.contains('active')) return;

        selectedCurrency = event.target.id === 'btn-brl' ? 'brl' : 'usd';
        
        document.querySelector('.currency-btn.active').classList.remove('active');
        event.target.classList.add('active');
        
        atualizarTudo();
    });

    periodSelector.addEventListener('click', (event) => {
        if (event.target.tagName !== 'BUTTON' || event.target.classList.contains('active')) return;
        
        selectedPeriod = event.target.dataset.period;
        
        document.querySelector('.period-btn.active').classList.remove('active');
        event.target.classList.add('active');
        
        atualizarGrafico();
    });
});