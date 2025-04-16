// Funciones de utilidad
function getRiskColor(volatility) {
    if (volatility >= 0.05) return '#ff4d4d';
    if (volatility >= 0.03) return '#ffa500';
    return '#00ff9d';
}

function formatNumber(number) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(number);
}

// Datos simulados de activos
let assets = [
    { id: 1, name: 'CryptoX', price: 1000, volatility: 0.05, priceHistory: [], sector: 'Crypto' },
    { id: 2, name: 'TechStock', price: 500, volatility: 0.03, priceHistory: [], sector: 'Technology' },
    { id: 3, name: 'GoldToken', price: 2000, volatility: 0.02, priceHistory: [], sector: 'Commodities' },
    { id: 4, name: 'EnergyFund', price: 750, volatility: 0.04, priceHistory: [], sector: 'Energy' },
    { id: 5, name: 'BankFin', price: 1200, volatility: 0.025, priceHistory: [], sector: 'Finance' },
    { id: 6, name: 'HealthCare', price: 850, volatility: 0.035, priceHistory: [], sector: 'Healthcare' },
    { id: 7, name: 'RealEstate', price: 1500, volatility: 0.03, priceHistory: [], sector: 'Real Estate' },
    { id: 8, name: 'AgroTech', price: 600, volatility: 0.045, priceHistory: [], sector: 'Agriculture' },
    { id: 9, name: 'AIToken', price: 300, volatility: 0.06, priceHistory: [], sector: 'Technology' },
    { id: 10, name: 'GreenEnergy', price: 900, volatility: 0.035, priceHistory: [], sector: 'Energy' }
];

// Portafolio del usuario
let portfolio = [];
let balance = 100000;

// Configuración del agente automático
let botActive = false;
let botStrategy = 'balanced'; // balanced, aggressive, conservative
let botTransactionHistory = [];

// Configuración de los gráficos
const tradingCtx = document.getElementById('tradingChart').getContext('2d');
const volumeCtx = document.getElementById('volumeChart').getContext('2d');

// Función para calcular indicadores técnicos
function calculateIndicators(prices) {
    const length = prices.length;
    if (length < 14) return { rsi: 50, ma: prices[length - 1] };

    // Calcular RSI
    let gains = 0, losses = 0;
    for (let i = length - 14; i < length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }
    const rs = gains / losses || 0;
    const rsi = 100 - (100 / (1 + rs));

    // Calcular Media Móvil Simple
    const ma = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;

    return { rsi, ma };
}

// Función para calcular MACD
function calculateMACD(prices) {
    const shortPeriod = 12;
    const longPeriod = 26;
    const signalPeriod = 9;

    // Calcular EMA
    function calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = data[0];
        const emaData = [ema];

        for (let i = 1; i < data.length; i++) {
            ema = (data[i] * k) + (ema * (1 - k));
            emaData.push(ema);
        }

        return emaData;
    }

    const shortEMA = calculateEMA(prices, shortPeriod);
    const longEMA = calculateEMA(prices, longPeriod);

    // Calcular línea MACD
    const macd = shortEMA.map((value, index) => value - longEMA[index]);

    // Calcular línea de señal
    const signal = calculateEMA(macd, signalPeriod);

    return { macd, signal };
}

// Función eliminada: calculateBotProjection

// Función para que el bot tome decisiones de inversión
function botMakeDecisions() {
    if (!botActive) return;
    
    // Analizar mercado y tomar decisiones
    assets.forEach(asset => {
        const priceHistory = asset.priceHistory;
        if (priceHistory.length < 5) return; // Necesitamos suficientes datos
        
        // Calcular tendencia reciente
        const recentPrices = priceHistory.slice(-5).map(record => record.price);
        const oldPrice = recentPrices[0];
        const currentPrice = recentPrices[recentPrices.length - 1];
        const trend = (currentPrice - oldPrice) / oldPrice;
        
        // Calcular volatilidad reciente
        let volatility = 0;
        for (let i = 1; i < recentPrices.length; i++) {
            volatility += Math.abs((recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]);
        }
        volatility /= recentPrices.length - 1;
        
        // Decisión basada en estrategia
        let shouldBuy = false;
        let shouldSell = false;
        const position = portfolio.find(item => item.assetId === asset.id);
        const positionValue = position ? position.quantity * currentPrice : 0;
        const portfolioValue = calculatePortfolioValue();
        
        switch(botStrategy) {
            case 'aggressive':
                // Compra en tendencias alcistas, vende en bajistas
                shouldBuy = trend > 0.01 && volatility < 0.04;
                shouldSell = trend < -0.01 || volatility > 0.06;
                break;
            case 'conservative':
                // Solo compra en tendencias muy claras, vende ante cualquier riesgo
                shouldBuy = trend > 0.02 && volatility < 0.02;
                shouldSell = trend < -0.005 || volatility > 0.03;
                break;
            default: // balanced
                // Equilibrio entre riesgo y oportunidad
                shouldBuy = trend > 0.015 && volatility < 0.03;
                shouldSell = trend < -0.015 || volatility > 0.05;
        }
        
        // Limitar exposición por activo según estrategia
        let maxExposure;
        switch(botStrategy) {
            case 'aggressive': maxExposure = 0.3; break; // 30% máximo en un activo
            case 'conservative': maxExposure = 0.15; break; // 15% máximo
            default: maxExposure = 0.2; // 20% máximo
        }
        
        // Ejecutar operaciones
        if (shouldBuy && positionValue / portfolioValue < maxExposure && balance > asset.price * 10) {
            // Calcular cantidad a comprar (10% del balance disponible)
            const investAmount = balance * 0.1;
            const quantity = Math.floor(investAmount / asset.price);
            
            if (quantity > 0) {
                botBuy(asset.id, quantity);
            }
        } else if (shouldSell && position && position.quantity > 0) {
            // Vender entre 30% y 100% según la fuerza de la señal
            const sellRatio = Math.min(1, Math.abs(trend) * 10);
            const quantity = Math.ceil(position.quantity * sellRatio);
            
            if (quantity > 0) {
                botSell(asset.id, quantity);
            }
        }
    });
    
    // Proyección eliminada
}

// Función para que el bot compre
function botBuy(assetId, quantity) {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    
    const totalCost = asset.price * quantity;
    if (totalCost > balance) return;
    
    balance -= totalCost;
    const existingPosition = portfolio.find(item => item.assetId === assetId);
    
    if (existingPosition) {
        existingPosition.quantity += quantity;
        existingPosition.currentPrice = asset.price;
    } else {
        portfolio.push({
            assetId,
            name: asset.name,
            quantity,
            buyPrice: asset.price,
            currentPrice: asset.price,
            botPurchased: true
        });
    }
    
    // Registrar transacción
    botTransactionHistory.push({
        type: 'buy',
        assetId,
        assetName: asset.name,
        quantity,
        price: asset.price,
        total: totalCost,
        time: new Date().toLocaleTimeString()
    });
    
    updatePortfolio();
    updateBalance();
}

// Función para que el bot venda
function botSell(assetId, quantity) {
    const position = portfolio.find(item => item.assetId === assetId);
    const asset = assets.find(a => a.id === assetId);
    
    if (!position || !asset || quantity > position.quantity) return;
    
    const totalValue = asset.price * quantity;
    balance += totalValue;
    position.quantity -= quantity;
    
    // Registrar transacción
    botTransactionHistory.push({
        type: 'sell',
        assetId,
        assetName: asset.name,
        quantity,
        price: asset.price,
        total: totalValue,
        time: new Date().toLocaleTimeString()
    });
    
    if (position.quantity === 0) {
        portfolio = portfolio.filter(item => item.assetId !== assetId);
    }
    
    updatePortfolio();
    updateBalance();
}

// Gráfico principal mejorado
let tradingChart = new Chart(tradingCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Valor del Portafolio',
            data: [],
            borderColor: '#00ff9d',
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(0, 255, 157, 0.1)',
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: '#00ff9d'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 500,
            easing: 'easeOutQuart'
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        scales: {
            y: {
                grid: {
                    color: '#333'
                },
                ticks: {
                    color: '#fff',
                    callback: function(value) {
                        return formatNumber(value);
                    }
                }
            },
            x: {
                grid: {
                    color: '#333'
                },
                ticks: {
                    color: '#fff'
                }
            }
        },
        plugins: {
            legend: {
                labels: {
                    color: '#fff'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#00ff9d',
                callbacks: {
                    label: function(context) {
                        return 'Valor: ' + formatNumber(context.raw);
                    }
                }
            }
        }
    }
});

// Inicializar la interfaz
function initializeInterface() {
    updateAssetsList();
    updatePortfolio();
    updateBalance();
    populateAssetSelect();
    updateChart();
    initBotControls();
}

// Inicializar controles del bot
function initBotControls() {
    const tradingForm = document.querySelector('.trading-form');
    
    // Crear sección de bot
    const botSection = document.createElement('div');
    botSection.className = 'bot-section';
    botSection.innerHTML = `
        <h3>Agente Automático</h3>
        <div class="bot-controls">
            <label class="switch">
                <input type="checkbox" id="botToggle">
                <span class="slider round"></span>
            </label>
            <span>Activar Bot</span>
        </div>
        <div class="bot-strategy">
            <label>Estrategia:</label>
            <select id="botStrategy">
                <option value="conservative">Conservadora</option>
                <option value="balanced" selected>Equilibrada</option>
                <option value="aggressive">Agresiva</option>
            </select>
        </div>

    `;
    
    tradingForm.parentNode.insertBefore(botSection, tradingForm.nextSibling);
    
    // Añadir event listeners
    document.getElementById('botToggle').addEventListener('change', function() {
        botActive = this.checked;
        if (botActive) {
            calculateBotProjection();
        }
    });
    
    document.getElementById('botStrategy').addEventListener('change', function() {
        botStrategy = this.value;
        if (botActive) {
            calculateBotProjection();
        }
    });
    

}

// Actualizar lista de activos
function updateAssetsList() {
    const assetsList = document.getElementById('assetsList');
    assetsList.innerHTML = '';
    
    assets.forEach((asset, index) => {
        const assetCard = document.createElement('div');
        assetCard.className = 'asset-card';
        assetCard.style.animation = `fadeIn 0.5s ease-out ${index * 0.1}s`;
        
        const previousPrice = asset.previousPrice || asset.price;
        const priceChange = ((asset.price - previousPrice) / previousPrice) * 100;
        const priceClass = priceChange >= 0 ? 'price-up' : 'price-down';
        
        assetCard.innerHTML = `
            <div class="asset-info">
                <span class="asset-name">${asset.name}</span>
                <span class="asset-sector">${asset.sector}</span>
                <span class="asset-price ${priceClass}">$${asset.price.toFixed(2)}</span>
            </div>
            <div class="price-change ${priceClass}">${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%</div>
            <div class="risk-indicator" style="background-color: ${getRiskColor(asset.volatility)}"></div>
            <button class="history-button" onclick="showAssetHistory(${asset.id})">Ver Historial</button>
        `;

        assetsList.appendChild(assetCard);
    });
}

// Actualizar portafolio
function updatePortfolio() {
    const portfolioList = document.getElementById('portfolioList');
    portfolioList.innerHTML = '';
    
    portfolio.forEach((item, index) => {
        const profitLoss = (item.currentPrice - item.buyPrice) * item.quantity;
        const totalValue = item.currentPrice * item.quantity;
        const percentageChange = ((item.currentPrice - item.buyPrice) / item.buyPrice) * 100;
        const portfolioItem = document.createElement('div');
        portfolioItem.className = 'portfolio-item';
        portfolioItem.style.animation = `slideIn 0.3s ease-out ${index * 0.1}s`;
        
        // Añadir indicador si fue comprado por el bot
        const botBadge = item.botPurchased ? '<span class="bot-badge">Bot</span>' : '';
        
        portfolioItem.innerHTML = `
            <div class="asset-info">
                <span class="asset-name">${item.name} ${botBadge}</span>
                <span class="asset-quantity">${item.quantity} unidades</span>
            </div>
            <div class="value-info">
                <span class="total-value">Valor Total: ${formatNumber(totalValue)}</span>
                <span class="${profitLoss >= 0 ? 'profit' : 'loss'}">
                    ${profitLoss >= 0 ? '+' : ''}${formatNumber(profitLoss)} (${percentageChange.toFixed(2)}%)
                </span>
            </div>
        `;
        portfolioList.appendChild(portfolioItem);
    });
    
    // Mostrar historial de transacciones del bot si está activo
    if (botActive && botTransactionHistory.length > 0) {
        const historySection = document.createElement('div');
        historySection.className = 'bot-history';
        historySection.innerHTML = `
            <h3>Últimas Operaciones del Bot</h3>
            <div class="transaction-list">
                ${botTransactionHistory.slice(-5).reverse().map(tx => `
                    <div class="transaction ${tx.type}">
                        <span class="time">${tx.time}</span>
                        <span class="action">${tx.type === 'buy' ? 'Compra' : 'Venta'}</span>
                        <span class="details">${tx.quantity} ${tx.assetName} a ${formatNumber(tx.price)}</span>
                        <span class="total">${formatNumber(tx.total)}</span>
                    </div>
                `).join('')}
            </div>
        `;
        portfolioList.appendChild(historySection);
    }
}

// Actualizar balance
function updateBalance() {
    document.getElementById('totalBalance').textContent = balance.toFixed(2);
}

// Poblar select de activos
function populateAssetSelect() {
    const select = document.getElementById('assetSelect');
    select.innerHTML = '<option value="">Seleccionar Activo</option>';
    assets.forEach(asset => {
        select.innerHTML += `<option value="${asset.id}">${asset.name}</option>`;
    });
}

// Gráfico de volumen
let volumeChart = new Chart(volumeCtx, {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Volumen',
            data: [],
            backgroundColor: 'rgba(0, 255, 157, 0.3)',
            borderColor: 'rgba(0, 255, 157, 0.7)',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#333' },
                ticks: { color: '#fff' }
            },
            x: {
                grid: { display: false },
                ticks: { display: false }
            }
        },
        plugins: {
            legend: { display: false }
        }
    }
});

// Datos para el gráfico de velas
let candlestickData = {
    open: [],
    high: [],
    low: [],
    close: []
};

// Simular cambios de precio
// Función para mostrar el historial de precios de un activo
function showAssetHistory(assetId) {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${asset.name} - Historial de Precios</h2>
            <canvas id="assetHistoryChart"></canvas>
            <div class="price-history-table">
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Precio</th>
                            <th>Cambio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${asset.priceHistory.map((record, index) => `
                            <tr>
                                <td>${record.time}</td>
                                <td>${formatNumber(record.price)}</td>
                                <td class="${record.change >= 0 ? 'price-up' : 'price-down'}">
                                    ${record.change >= 0 ? '+' : ''}${record.change.toFixed(2)}%
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button onclick="this.parentElement.parentElement.remove()">Cerrar</button>
        </div>
    `;
    document.body.appendChild(modal);

    const ctx = document.getElementById('assetHistoryChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: asset.priceHistory.map(record => record.time),
            datasets: [{
                label: 'Precio',
                data: asset.priceHistory.map(record => record.price),
                borderColor: '#00ff9d',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(0, 255, 157, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: '#333' },
                    ticks: {
                        color: '#fff',
                        callback: value => formatNumber(value)
                    }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#fff' }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

function simulatePriceChanges() {
    assets = assets.map(asset => {
        const change = (Math.random() - 0.5) * 2 * asset.volatility;
        const previousPrice = asset.price;
        const newPrice = asset.price * (1 + change);
        
        // Añadir tendencia del mercado
        const marketTrend = Math.random() > 0.5 ? 1.001 : 0.999;
        const finalPrice = newPrice * marketTrend;
        
        // Actualizar historial de precios
        const priceChange = ((finalPrice - previousPrice) / previousPrice) * 100;
        asset.priceHistory.push({
            time: new Date().toLocaleTimeString(),
            price: finalPrice,
            change: priceChange
        });
        
        // Mantener solo los últimos 50 registros
        if (asset.priceHistory.length > 50) {
            asset.priceHistory.shift();
        }
        
        return { 
            ...asset, 
            previousPrice: previousPrice,
            price: finalPrice
        };
    });


    portfolio = portfolio.map(item => {
        const asset = assets.find(a => a.id === item.assetId);
        return { ...item, currentPrice: asset.price };
    });

    updateAssetsList();
    updatePortfolio();
    updateChart();
}

// Comprar activo
function buy() {
    const assetId = parseInt(document.getElementById('assetSelect').value);
    const quantity = parseInt(document.getElementById('amount').value);
    const asset = assets.find(a => a.id === assetId);

    if (!asset || !quantity || quantity <= 0) {
        alert('Por favor, seleccione un activo y una cantidad válida');
        return;
    }

    const totalCost = asset.price * quantity;
    if (totalCost > balance) {
        alert('Balance insuficiente');
        return;
    }

    balance -= totalCost;
    const existingPosition = portfolio.find(item => item.assetId === assetId);
    
    if (existingPosition) {
        existingPosition.quantity += quantity;
        existingPosition.currentPrice = asset.price;
    } else {
        portfolio.push({
            assetId,
            name: asset.name,
            quantity,
            buyPrice: asset.price,
            currentPrice: asset.price
        });
    }

    updatePortfolio();
    updateBalance();
    document.getElementById('amount').value = '';
}

// Vender activo
function sell() {
    const assetId = parseInt(document.getElementById('assetSelect').value);
    const quantity = parseInt(document.getElementById('amount').value);
    const position = portfolio.find(item => item.assetId === assetId);
    const asset = assets.find(a => a.id === assetId);

    if (!position || !quantity || quantity <= 0) {
        alert('Por favor, seleccione un activo y una cantidad válida');
        return;
    }

    if (quantity > position.quantity) {
        alert('No tiene suficientes unidades para vender');
        return;
    }

    const totalValue = asset.price * quantity;
    balance += totalValue;
    position.quantity -= quantity;

    if (position.quantity === 0) {
        portfolio = portfolio.filter(item => item.assetId !== assetId);
    }

    updatePortfolio();
    updateBalance();
    document.getElementById('amount').value = '';
}

// Función para calcular el valor total del portafolio
function calculatePortfolioValue() {
    return portfolio.reduce((total, item) => {
        return total + (item.currentPrice * item.quantity);
    }, balance);
}

function updateChart() {
    const portfolioValue = calculatePortfolioValue();
    const time = new Date().toLocaleTimeString();
    const chartType = document.getElementById('chartType').value;

    // Actualizar datos de velas
    candlestickData.open.push(portfolioValue * 0.995);
    candlestickData.high.push(portfolioValue * 1.005);
    candlestickData.low.push(portfolioValue * 0.99);
    candlestickData.close.push(portfolioValue);

    if (candlestickData.open.length > 50) {
        candlestickData.open.shift();
        candlestickData.high.shift();
        candlestickData.low.shift();
        candlestickData.close.shift();
    }

    // Actualizar gráfico según el tipo seleccionado
    tradingChart.data.labels.push(time);
    tradingChart.data.datasets[0].data.push(portfolioValue);
    
    if (chartType === 'candlestick') {
        tradingChart.data.datasets[0] = {
            label: 'Velas Japonesas',
            data: candlestickData.close,
            type: 'candlestick',
            candlestick: {
                color: {
                    upward: '#00ff9d',
                    downward: '#ff4d4d'
                }
            }
        };
    } else if (chartType === 'area') {
        tradingChart.data.datasets[0] = {
            label: 'Valor del Portafolio',
            data: tradingChart.data.datasets[0].data,
            fill: true,
            backgroundColor: 'rgba(0, 255, 157, 0.2)',
            borderColor: '#00ff9d',
            tension: 0.4
        };
    } else {
        tradingChart.data.datasets[0] = {
            label: 'Valor del Portafolio',
            data: tradingChart.data.datasets[0].data,
            borderColor: '#00ff9d',
            tension: 0.4,
            fill: false,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: '#00ff9d'
        };
    }
    
    // Eliminar cualquier proyección del bot
    tradingChart.data.datasets = tradingChart.data.datasets.filter(dataset => dataset.label !== 'Proyección Bot');
    
    // Asegurar que las etiquetas coincidan con los datos
    while (tradingChart.data.labels.length > tradingChart.data.datasets[0].data.length) {
        tradingChart.data.labels.pop();
    }

    if (tradingChart.data.labels.length > 50 && !botActive) {
        tradingChart.data.labels.shift();
        tradingChart.data.datasets[0].data.shift();
    }

    // Actualizar volumen
    volumeChart.data.labels = tradingChart.data.labels.slice(0, tradingChart.data.datasets[0].data.length);
    volumeChart.data.datasets[0].data.push(Math.random() * 1000);
    if (volumeChart.data.datasets[0].data.length > 50) {
        volumeChart.data.datasets[0].data.shift();
    }

    tradingChart.update();
    volumeChart.update();
    updateIndicators();
}

function updateIndicators() {
    const prices = tradingChart.data.datasets[0].data;
    const indicators = calculateIndicators(prices);

    // Actualizar RSI
    if (document.getElementById('showRSI').checked) {
        const rsiDataset = {
            label: 'RSI',
            data: Array(prices.length).fill(null),
            borderColor: '#ffa500',
            fill: false,
            yAxisID: 'rsi'
        };
        rsiDataset.data[prices.length - 1] = indicators.rsi;
        tradingChart.data.datasets = tradingChart.data.datasets.filter(d => d.label !== 'RSI');
        tradingChart.data.datasets.push(rsiDataset);

        if (!tradingChart.options.scales.rsi) {
            tradingChart.options.scales.rsi = {
                type: 'linear',
                display: true,
                position: 'right',
                min: 0,
                max: 100,
                grid: { color: '#333' },
                ticks: { color: '#ffa500' }
            };
        }
    } else {
        tradingChart.data.datasets = tradingChart.data.datasets.filter(d => d.label !== 'RSI');
        delete tradingChart.options.scales.rsi;
    }

    // Actualizar Media Móvil
    if (document.getElementById('showMA').checked) {
        const maDataset = {
            label: 'Media Móvil',
            data: Array(prices.length).fill(indicators.ma),
            borderColor: '#ff4d4d',
            fill: false,
            tension: 0.4
        };
        tradingChart.data.datasets = tradingChart.data.datasets.filter(d => d.label !== 'Media Móvil');
        tradingChart.data.datasets.push(maDataset);
    } else {
        tradingChart.data.datasets = tradingChart.data.datasets.filter(d => d.label !== 'Media Móvil');
    }

    // Actualizar MACD
    if (document.getElementById('showMACD').checked) {
        const macdData = calculateMACD(prices);
        const macdDataset = {
            label: 'MACD',
            data: macdData.macd,
            borderColor: '#4d79ff',
            fill: false,
            yAxisID: 'macd'
        };
        const signalDataset = {
            label: 'Señal MACD',
            data: macdData.signal,
            borderColor: '#ff4d4d',
            fill: false,
            yAxisID: 'macd'
        };

        tradingChart.data.datasets = tradingChart.data.datasets.filter(d => !['MACD', 'Señal MACD'].includes(d.label));
        tradingChart.data.datasets.push(macdDataset, signalDataset);

        if (!tradingChart.options.scales.macd) {
            tradingChart.options.scales.macd = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: { color: '#333' },
                ticks: { color: '#4d79ff' }
            };
        }
    } else {
        tradingChart.data.datasets = tradingChart.data.datasets.filter(d => !['MACD', 'Señal MACD'].includes(d.label));
        delete tradingChart.options.scales.macd;
    }

    tradingChart.update();
}

// Inicializar la aplicación
initializeInterface();

// Actualizar el gráfico cada 5 segundos
setInterval(() => {
    simulatePriceChanges();
    if (botActive) {
        botMakeDecisions();
    }
    updateChart();
}, 5000);