import { DAY, SourceError, iso, number, observation, request, time } from './observations.js';

const SEC = 'SEC EDGAR';
const DATA = 'https://data.sec.gov';
const ARCHIVES = 'https://www.sec.gov';
const FILER_CIK = '0001067983';
const INSTRUMENT_IDS = {
  AAPL: '037833100', MSFT: '594918104', NVDA: '67066G104', GOOGL: '02079K305',
  AMZN: '023135106', META: '30303M102', TSLA: '88160R101', AMD: '007903107',
};

const CONCEPTS = {
  assets: ['Assets'], currentAssets: ['AssetsCurrent'], currentLiabilities: ['LiabilitiesCurrent'],
  liabilities: ['Liabilities'], equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  retained: ['RetainedEarningsAccumulatedDeficit'], cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  longDebt: ['LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'],
  currentDebt: ['LongTermDebtCurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent'], shortDebt: ['ShortTermBorrowings', 'CommercialPaper'],
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'Revenues'],
  gross: ['GrossProfit'], operating: ['OperatingIncomeLoss'], net: ['NetIncomeLoss', 'ProfitLoss'],
  cashFlow: ['NetCashProvidedByUsedInOperatingActivities'], interest: ['InterestExpense', 'InterestExpenseNonOperating'],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], shares: ['WeightedAverageNumberOfSharesOutstandingBasic', 'WeightedAverageNumberOfDilutedSharesOutstanding'],
};
const UNITS = { eps: 'USD/shares', shares: 'shares' };
const INSTANT = new Set(['assets', 'currentAssets', 'currentLiabilities', 'liabilities', 'equity', 'retained', 'cash', 'longDebt', 'currentDebt', 'shortDebt']);
let nextRequestAt = 0;

async function edgar(path, origin, signal, format) {
  const userAgent = process.env.SEC_EDGAR_USER_AGENT?.trim();
  if (!userAgent || !/\S+@\S+\.\S+/.test(userAgent)) {
    throw new SourceError(SEC, 'Configura el nombre y correo de contacto del equipo en SEC_EDGAR_USER_AGENT.');
  }
  const due = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = due + 125;
  if (due > Date.now()) await new Promise(resolve => setTimeout(resolve, due - Date.now()));
  return request(SEC, new URL(path, origin), { headers: { 'User-Agent': userAgent }, signal, format });
}

export async function issuerIndex(signal) {
  const body = await edgar('/files/company_tickers.json', ARCHIVES, signal);
  const records = Object.values(body).filter(row => row.ticker && Number.isSafeInteger(row.cik_str));
  if (!records.length) throw new SourceError(SEC, 'El índice de emisoras no contiene registros utilizables.');
  return new Map(records.map(row => [row.ticker, String(row.cik_str).padStart(10, '0')]));
}

function visibleFilings(recent, asOf) {
  return new Map((recent?.accessionNumber ?? []).flatMap((accession, i) => {
    const filed = recent.filingDate[i];
    const accepted = time(recent.acceptanceDateTime?.[i]);
    const published = Number.isFinite(accepted) ? accepted : time(filed) + DAY;
    return published <= asOf ? [[accession, { filed, published }]] : [];
  }));
}

function factsFor(facts, concept, names, asOf, filings) {
  const form = /^(10-K|20-F)(\/A)?$/;
  return names.flatMap(name => (facts[name]?.units?.[UNITS[concept] ?? 'USD'] ?? []).flatMap(item => {
    const filing = filings.get(item.accn);
    const published = filing?.published ?? time(item.filed) + DAY;
    const duration = (time(item.end) - time(item.start)) / DAY;
    if (!form.test(item.form) || !Number.isFinite(time(item.end)) || published > asOf
        || !(time(item.end) < published) || !Number.isFinite(published) || number(item.val) === null
        || (INSTANT.has(concept) ? Boolean(item.start) : duration < 330 || duration > 390)) return [];
    return [{ value: Number(item.val), end: item.end, name, published, accession: item.accn }];
  }));
}

export async function statements(symbol, index, asOf, signal) {
  const cik = index.get(symbol);
  if (!cik) throw new SourceError(SEC, `No hay CIK de la emisora ${symbol}.`);
  const [company, submissions] = await Promise.all([
    edgar(`/api/xbrl/companyfacts/CIK${cik}.json`, DATA, signal),
    edgar(`/submissions/CIK${cik}.json`, DATA, signal),
  ]);
  const facts = company.facts?.['us-gaap'];
  if (!facts || Number(company.cik) !== Number(cik) || Number(submissions.cik) !== Number(cik)) {
    throw new SourceError(SEC, `Estados financieros sin identificación verificable para ${symbol}.`);
  }
  const filings = visibleFilings(submissions.filings?.recent, asOf);
  const concepts = Object.fromEntries(Object.entries(CONCEPTS).map(([concept, names]) => [concept, factsFor(facts, concept, names, asOf, filings)]));
  const periods = [...new Set(concepts.revenue.map(item => item.end))].sort().reverse().slice(0, 2);
  if (periods.length < 2 || !((asOf - time(periods[0])) / DAY <= 460)
      || !((time(periods[0]) - time(periods[1])) / DAY >= 330 && (time(periods[0]) - time(periods[1])) / DAY <= 390)) {
    throw new SourceError(SEC, `No hay dos ejercicios consecutivos y vigentes para ${symbol}.`);
  }
  const references = [];
  const years = periods.map(end => {
    const data = { end };
    for (const [key, items] of Object.entries(concepts)) {
      const fact = items.filter(item => item.end === end).sort((a, b) => b.published - a.published
        || CONCEPTS[key].indexOf(a.name) - CONCEPTS[key].indexOf(b.name))[0];
      data[key] = fact?.value ?? null;
      if (fact) references.push({ period: end, concept: fact.name, accession: fact.accession, publishedAt: iso(fact.published) });
    }
    return data;
  });
  return { years, cik, sic: Number(submissions.sic), evidence: [
    ...periods.map(end => observation(SEC, end, `CIK ${cik} · ejercicio al ${end}`)),
  ], references };
}

function field(xml, key) {
  return xml.match(new RegExp(`<(?:(?:\\w+):)?${key}(?:\\s[^>]*)?>\\s*([^<]*?)\\s*</`, 'i'))?.[1];
}

function parseHoldings(xml) {
  return [...xml.matchAll(/<(?:(?:\w+):)?infoTable(?:\s[^>]*)?>([\s\S]*?)<\/(?:(?:\w+):)?infoTable\s*>/gi)]
    .flatMap(([, row]) => {
      const cusip = field(row, 'cusip');
      const shares = number(field(row, 'sshPrnamt'));
      if (!cusip || shares === null) return [];
      return [{ cusip, shares, issuer: field(row, 'nameOfIssuer'), option: field(row, 'putCall') ?? null }];
    });
}

export async function holdingsReport(asOf, signal) {
  const body = await edgar(`/submissions/CIK${FILER_CIK}.json`, DATA, signal);
  const recent = body.filings?.recent;
  const filings = visibleFilings(recent, asOf);
  const i = (recent?.form ?? []).findIndex((form, index) => form === '13F-HR' && filings.has(recent.accessionNumber[index]));
  if (i < 0) throw new SourceError(SEC, 'No se encontró un 13F público para el gestor consultado.');
  const accession = recent.accessionNumber[i];
  const period = recent.reportDate[i];
  if (!/^\d{10}-\d{2}-\d{6}$/.test(accession) || asOf - time(period) > 190 * DAY || !Number.isFinite(time(period))) {
    throw new SourceError(SEC, 'El reporte institucional no tiene un periodo vigente o identificable.');
  }
  const folder = `/Archives/edgar/data/${Number(FILER_CIK)}/${accession.replaceAll('-', '')}/`;
  const index = await edgar(`${folder}index.json`, ARCHIVES, signal);
  const names = (index.directory?.item ?? []).map(item => item.name).filter(name => /^[A-Za-z0-9_.-]+\.xml$/i.test(name) && name !== 'primary_doc.xml');
  for (const name of names.slice(0, 5)) {
    const xml = await edgar(`${folder}${name}`, ARCHIVES, signal, 'text');
    const rows = parseHoldings(xml);
    if (rows.length) return { rows, period, filer: body.name, evidence: observation(`${SEC} · 13F`, period, `${accession} · publicado ${recent.filingDate[i]}`) };
  }
  throw new SourceError(SEC, 'No se encontró la tabla de posiciones del 13F.');
}

export function reportedHoldings(report, symbol) {
  const cusip = INSTRUMENT_IDS[symbol];
  if (!cusip || !report) return null;
  return { filer: report.filer, period: report.period, cusip, positions: report.rows.filter(row => row.cusip === cusip) };
}
