import deployment from './deployment.json';

export type FundStatus = 'live' | 'investors-only' | 'seeding';

export interface Fund {
  key: string;
  ticker: string;
  name: string;
  manager: string;
  logo: { text: string; bg: string; fg: string };
  aum: number;
  apy: number | null;
  tokenPrice: number | null;
  assetType: string;
  minInvestment: string;
  status: FundStatus;
  ratings: { label: string; tone: string }[];
  integrations: string[];
  issuer: string;
  benchmark: string;
  inception: string;
  averageMaturity?: string;
  expenseRatio: string;
  entryExitFees: string;
  liquidity: string;
  structure: string;
  domicile: string;
  eligibility: string;
  riskProfile: string;
  description: string;
  overviewPoints: string[];
  characteristics: string[];
  performance: { threeMonths: number; sixMonths: number; twelveMonths: number };
  serviceProviders: { label: string; value: string }[];
  /** Present only for funds actually deployed on COTI testnet. */
  contracts?: { token: string; subscription: string; registry: string; compliance: string };
}

const deployed = deployment.funds as Record<string, any>;

const JH = { text: 'JH', bg: '#1a1a1a', fg: '#ffffff' };

export const FUNDS: Fund[] = [
  {
    key: 'JTRSY',
    ticker: 'JTRSY',
    name: 'Janus Henderson Treasury Fund',
    manager: 'Janus Henderson',
    logo: JH,
    aum: 881_875_323,
    apy: 3.62,
    tokenPrice: 1.112439,
    assetType: 'US Treasury Bills',
    minInvestment: '500K USD',
    status: 'live',
    ratings: [
      { label: 'Aa-bf', tone: 'blue' },
      { label: 'AA+', tone: 'grey' },
      { label: 'AAA+f/S1+', tone: 'red' },
    ],
    integrations: ['morpho'],
    issuer: 'Anemoy Capital SPC Limited',
    benchmark: 'U.S. Treasury Bill 0-6 Month Indices',
    inception: 'December 2022',
    averageMaturity: '63.33 days',
    expenseRatio: '0.25%',
    entryExitFees: 'None',
    liquidity: 'Daily (T+0/T+1)',
    structure: 'BVI professional fund',
    domicile: 'British Virgin Islands (BVI)',
    eligibility: 'Non-US Professional Investors',
    riskProfile: 'Low',
    description:
      'COTI RWA Anemoy Treasury Fund (the Fund) is a tokenized British Virgin Islands (BVI) professional fund licensed by the British Virgin Islands Financial Services Commission (FSC), and open to non-US Professional Investors. The Fund invests in short-term U.S. Treasury Bills with a remaining maturity of 0 to 6 months, combining daily liquidity and money market returns. T-bills are held directly by the Fund and Assets Under Management (AUM) can be checked onchain. The fund issues its shares as the JTRSY token to investors. Investments and redemptions are processed in stablecoins. Janus Henderson Investors acts as the sub-Investment Manager of the Fund.',
    overviewPoints: [
      'Fund shares are issued in tokens directly on the supported chain of the investor’s choice',
      'Subscription & redemption in USDC and other stablecoins',
      'Open ended BVI professional fund for non-US Professional Investors',
      '0 to 6 months laddered US Treasury Bills strategy',
      'Daily subscriptions and redemptions; settlement is T+0 (10:00 ET cutoff) or T+1 (15:00 ET cutoff)',
    ],
    characteristics: [
      'Balanced to maintain a portfolio of less than 6 months US Treasury Bills and Weighted Average Maturity of around 45 days.',
      'Low volatility, interest bearing asset backed by US government',
      'Direct US Treasury Bill ownership via tokenized fund shares allows redemptions and yield',
      'COTI RWA provides real-time transparency of the fund portfolio and NAV.',
      'Independently tokenizing a US Treasuries portfolio is less costly than tokenizing a third-party fund (ETFs, mutual funds, etc.)',
    ],
    performance: { threeMonths: 3.41, sixMonths: 3.32, twelveMonths: 3.57 },
    serviceProviders: [
      { label: 'Portfolio Manager', value: 'Janus Henderson Investors' },
      { label: 'Custodian', value: 'J.P. Morgan' },
      { label: 'Fund Administrator', value: 'Trident Trust' },
      { label: 'Auditor', value: 'MHA Cayman' },
      { label: 'Oracle', value: 'Chronicle' },
      { label: 'Wallet Infrastructure', value: 'Fordefi' },
    ],
    contracts: deployed.JTRSY
      ? {
          token: deployed.JTRSY.token,
          subscription: deployed.JTRSY.subscription,
          registry: deployed.JTRSY.registry,
          compliance: deployed.JTRSY.compliance,
        }
      : undefined,
  },
  {
    key: 'JAAA',
    ticker: 'JAAA',
    name: 'Janus Henderson AAA CLO Fund',
    manager: 'Janus Henderson',
    logo: JH,
    aum: 691_177_358,
    apy: 4.52,
    tokenPrice: 1.04445,
    assetType: 'AAA-rated CLOs',
    minInvestment: '500K USD',
    status: 'live',
    ratings: [{ label: 'AAA', tone: 'blue' }],
    integrations: ['morpho', 'aave', 'sky'],
    issuer: 'Anemoy Capital SPC Limited',
    benchmark: 'AAA-Rated Collateralized Loan Obligation Index',
    inception: '25 July 2025',
    expenseRatio: '0.30%',
    entryExitFees: 'None',
    liquidity: 'Daily (T+1)',
    structure: 'BVI professional fund',
    domicile: 'British Virgin Islands (BVI)',
    eligibility: 'Non-US Professional Investors',
    riskProfile: 'Low',
    description:
      'Janus Henderson Anemoy AAA CLO Fund (the Fund) is a tokenized British Virgin Islands (BVI) professional fund, licensed by the British Virgin Islands Financial Services Commission (FSC), and open to non-US Professional Investors. The Fund invests in a portfolio of high-quality CLOs delivering risk-managed access to an asset class that can provide consistent risk-adjusted returns and low correlation to traditional fixed income asset classes while exhibiting low volatility with low downgrade risk. CLOs are held directly by the Fund and Assets Under Management (AUM) can be checked onchain. The fund issues its shares as the JAAA token to investors. Investments and redemptions are processed in stablecoins. Janus Henderson Investors acts as the sub-Investment Manager of the Fund.',
    overviewPoints: [
      'Fund shares are issued in tokens directly on the supported chain of the investor’s choice',
      'Subscription & redemption in USDC and other stablecoins',
      'Open ended BVI professional fund for non-US Professional Investors',
      'Portfolio of AAA-rated Collateralized Loan Obligations',
    ],
    characteristics: [
      'Diversified exposure to the senior-most tranche of the CLO capital structure',
      'Low correlation to traditional fixed income',
      'Daily transparency of holdings and NAV onchain',
    ],
    performance: { threeMonths: 4.48, sixMonths: 4.51, twelveMonths: 4.62 },
    serviceProviders: [
      { label: 'Portfolio Manager', value: 'Janus Henderson Investors' },
      { label: 'Custodian', value: 'J.P. Morgan' },
      { label: 'Fund Administrator', value: 'Trident Trust' },
      { label: 'Auditor', value: 'MHA Cayman' },
      { label: 'Oracle', value: 'Chronicle' },
      { label: 'Wallet Infrastructure', value: 'Fordefi' },
    ],
    contracts: deployed.JAAA
      ? {
          token: deployed.JAAA.token,
          subscription: deployed.JAAA.subscription,
          registry: deployed.JAAA.registry,
          compliance: deployed.JAAA.compliance,
        }
      : undefined,
  },
  {
    key: 'ACRDX',
    ticker: 'ACRDX',
    name: 'Anemoy Tokenized Apollo Diversified Credit Fund',
    manager: 'Apollo',
    logo: { text: 'A', bg: '#0f7b5f', fg: '#ffffff' },
    aum: 43_376_831,
    apy: null,
    tokenPrice: 1.0,
    assetType: 'Private Credit',
    minInvestment: '500K USD',
    status: 'live',
    ratings: [],
    integrations: [],
    issuer: 'Anemoy Capital SPC Limited',
    benchmark: 'Apollo Diversified Credit',
    inception: 'February 2025',
    expenseRatio: '0.50%',
    entryExitFees: 'None',
    liquidity: 'Monthly',
    structure: 'BVI professional fund',
    domicile: 'British Virgin Islands (BVI)',
    eligibility: 'Non-US Professional Investors',
    riskProfile: 'Medium',
    description:
      'A feeder into the Apollo Diversified Credit Fund, tokenized as ACRDX and launched with COTI RWA. The strategy provides diversified exposure to global credit markets across corporate direct lending, asset-backed finance and performing credit.',
    overviewPoints: [
      'Feeder into the Apollo Diversified Credit Fund',
      'Subscription & redemption in USDC and other stablecoins',
      'Open ended BVI professional fund for non-US Professional Investors',
    ],
    characteristics: [
      'Diversified global credit exposure managed by Apollo',
      'Monthly liquidity',
    ],
    performance: { threeMonths: 2.1, sixMonths: 4.3, twelveMonths: 8.7 },
    serviceProviders: [
      { label: 'Portfolio Manager', value: 'Apollo Global Management' },
      { label: 'Fund Administrator', value: 'Trident Trust' },
      { label: 'Auditor', value: 'MHA Cayman' },
    ],
  },
  {
    key: 'SPXA',
    ticker: 'SPXA',
    name: 'Janus Henderson S&P500® Fund',
    manager: 'Janus Henderson',
    logo: JH,
    aum: 0,
    apy: null,
    tokenPrice: null,
    assetType: 'Equities',
    minInvestment: '500K USD',
    status: 'investors-only',
    ratings: [],
    integrations: [],
    issuer: 'Anemoy Capital SPC Limited',
    benchmark: 'S&P 500 Index',
    inception: '2026',
    expenseRatio: '0.20%',
    entryExitFees: 'None',
    liquidity: 'Daily',
    structure: 'BVI professional fund',
    domicile: 'British Virgin Islands (BVI)',
    eligibility: 'Non-US Professional Investors',
    riskProfile: 'Medium',
    description:
      'The first licensed tokenized S&P 500 index fund, launched with S&P Dow Jones Indices. Access to the benchmark US equity index through a tokenized fund share.',
    overviewPoints: ['First licensed tokenized S&P 500 index fund', 'Licensed index data from S&P Dow Jones Indices'],
    characteristics: ['Tracks the S&P 500 Index', 'Daily liquidity'],
    performance: { threeMonths: 0, sixMonths: 0, twelveMonths: 0 },
    serviceProviders: [{ label: 'Portfolio Manager', value: 'Janus Henderson Investors' }],
  },
  {
    key: 'HYB',
    ticker: 'HYB',
    name: 'NYLIM US High Yield Bond Fund',
    manager: 'New York Life Investments',
    logo: { text: 'NY', bg: '#1c4b9c', fg: '#ffffff' },
    aum: 0,
    apy: null,
    tokenPrice: null,
    assetType: 'US High Yield Corporate Bonds',
    minInvestment: '100K USD',
    status: 'seeding',
    ratings: [],
    integrations: [],
    issuer: 'New York Life Investment Management',
    benchmark: 'US High Yield Corporate Bond Index',
    inception: 'June 2026',
    expenseRatio: '0.45%',
    entryExitFees: 'None',
    liquidity: 'Daily',
    structure: 'BVI professional fund',
    domicile: 'British Virgin Islands (BVI)',
    eligibility: 'Non-US Professional Investors',
    riskProfile: 'Medium',
    description:
      'A tokenized US high yield corporate bond strategy from New York Life Investment Management, deployed as a share class on COTI RWA.',
    overviewPoints: ['US high yield corporate bond strategy', 'Share class deployed, not yet issued'],
    characteristics: ['Actively managed high yield portfolio'],
    performance: { threeMonths: 0, sixMonths: 0, twelveMonths: 0 },
    serviceProviders: [{ label: 'Portfolio Manager', value: 'New York Life Investment Management' }],
  },
];

export const getFund = (key: string) => FUNDS.find((f) => f.key === key);

export const TOTAL_AUM = FUNDS.reduce((s, f) => s + f.aum, 0) + 21_733_592;
