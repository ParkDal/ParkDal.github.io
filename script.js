(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.addEventListener('click', (event) => {
      if (event.target.matches('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const weatherPlace = document.querySelector('#weather-place');
  const weatherValue = document.querySelector('#weather-value');
  const weatherMeta = document.querySelector('#weather-meta');
  const exchangeContent = document.querySelector('#exchange-content');
  const weatherRefresh = document.querySelector('#weather-refresh');
  const exchangeRefresh = document.querySelector('#exchange-refresh');
  const fallbackLocation = { latitude: 37.5665, longitude: 126.978, label: '서울, 대한민국' };
  const weatherText = { 0: '맑음', 1: '대체로 맑음', 2: '부분적으로 흐림', 3: '흐림', 45: '안개', 48: '짙은 안개', 51: '이슬비', 61: '비', 71: '눈', 80: '소나기', 95: '뇌우' };
  const currencies = ['USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD'];

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`request-${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadWeather(location = fallbackLocation, isFallback = location === fallbackLocation) {
    if (!weatherPlace || !weatherValue || !weatherMeta) return;
    weatherPlace.textContent = location.label;
    weatherValue.textContent = '...';
    weatherMeta.textContent = isFallback ? '서울 날씨를 불러오는 중입니다.' : '현재 위치 날씨를 불러오는 중입니다.';
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
      const data = await fetchJson(url);
      const current = data.current;
      if (!current || typeof current.temperature_2m !== 'number') throw new Error('weather-payload');
      weatherPlace.textContent = location.label;
      weatherValue.textContent = `${Math.round(current.temperature_2m)}°C`;
      weatherMeta.textContent = `${weatherText[current.weather_code] || '현재 날씨'} · 바람 ${Math.round(current.wind_speed_10m || 0)} km/h · ${data.timezone || '현지 시간대'}`;
    } catch (error) {
      if (!isFallback) return loadWeather(fallbackLocation, true);
      weatherValue.textContent = '--°C';
      weatherMeta.textContent = '날씨를 불러오지 못했습니다. 새로고침을 눌러 다시 시도해주세요.';
    }
  }

  function requestWeather() {
    if (!navigator.geolocation) return loadWeather();
    navigator.geolocation.getCurrentPosition(
      (position) => loadWeather({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: '현재 위치' }, false),
      () => loadWeather(),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 900000 }
    );
  }

  function renderExchange(rates, date) {
    if (!exchangeContent) return;
    exchangeContent.innerHTML = currencies.map((currency) => {
      const value = rates[currency];
      const krwPerUnit = typeof value === 'number' && Number.isFinite(value) && value > 0 ? 1 / value : null;
      const formatted = krwPerUnit === null ? '—' : krwPerUnit.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
      return `<div class="exchange-row"><span>1 ${currency}</span><span>→ ${formatted} KRW</span></div>`;
    }).join('');
    const note = document.createElement('p');
    note.className = 'exchange-date';
    note.textContent = `기준일 ${date} · 각 통화 1단위 기준`;
    exchangeContent.append(note);
  }

  function readExchangeCache(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { return null; }
  }

  async function loadExchange(force = false) {
    if (!exchangeContent) return;
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'parkdal-exchange-v1';
    const cached = readExchangeCache(cacheKey);
    if (!force && cached?.day === today && cached.rates) return renderExchange(cached.rates, cached.date);
    exchangeContent.innerHTML = '<p>환율을 불러오는 중입니다.</p>';
    const query = currencies.join(',');
    const endpoints = [
      `https://api.frankfurter.dev/v2/rates?base=KRW&quotes=${query}`,
      `https://api.frankfurter.dev/v1/latest?base=KRW&symbols=${query}`
    ];
    try {
      let payload;
      let lastError;
      for (const endpoint of endpoints) {
        try { payload = await fetchJson(endpoint); break; } catch (error) { lastError = error; }
      }
      if (!payload) throw lastError || new Error('exchange-unavailable');
      const rows = Array.isArray(payload) ? payload : Object.entries(payload.rates || {}).map(([quote, rate]) => ({ quote, rate }));
      const rates = Object.fromEntries(rows.map((row) => [row.quote || row.currency, Number(row.rate)]));
      if (Object.keys(rates).length === 0) throw new Error('exchange-empty');
      const date = payload.date || rows[0]?.date || today;
      try { localStorage.setItem(cacheKey, JSON.stringify({ day: today, date, rates })); } catch (error) { /* cache is optional */ }
      renderExchange(rates, date);
    } catch (error) {
      if (cached?.rates) return renderExchange(cached.rates, cached.date);
      exchangeContent.innerHTML = '<p>환율을 불러오지 못했습니다. 새로고침을 눌러 다시 시도해주세요.</p>';
    }
  }

  weatherRefresh?.addEventListener('click', requestWeather);
  exchangeRefresh?.addEventListener('click', () => loadExchange(true));
  requestWeather();
  loadExchange();
})();
