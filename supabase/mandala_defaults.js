// Block order in the 3×3 mandala grid (reading order: TL → BR)
export const BLOCK_ORDER = [
  'Team', 'Founder Discipline', 'M&A Process',
  'Tech', 'CORE',              'Brand',
  'Referral Network', 'Buyer Network', 'Pipeline',
];

// The 8 surrounding labels shown around the core block (reading order, center skipped)
export const SURROUND_KEYS = [
  'Team',             'Founder Discipline', 'M&A Process',
  'Tech',             null,                 'Brand',
  'Referral Network', 'Buyer Network',      'Pipeline',
];

// How each surround label wraps in its cell
export const SURROUND_DISPLAY = {
  'Team':             'Team',
  'Founder Discipline': 'Founder\nDiscipline',
  'M&A Process':      'M&A\nProcess',
  'Tech':             'Tech',
  'Brand':            'Brand',
  'Referral Network': 'Referral\nNetwork',
  'Buyer Network':    'Buyer\nNetwork',
  'Pipeline':         'Pipeline',
};

// Core goal shown in the dead-centre cell
export const CORE_LABEL = '25 Deals\nClosed by\nApril 2029';

// o = owner (CEO/Pres/CTO/All), t = term (N = near-term, L = long-term)
// cells are ordered TL→BR with the centre position omitted (8 entries per block)
export const DEFAULTS = {
  'Team': {
    center: 'Team',
    cells: [
      { l: 'Engineers\n(2x)',        o: 'CEO', t: 'N', tip: '' },
      { l: 'GTM Lead',               o: 'CEO', t: 'N', tip: '' },
      { l: 'Rohit\n(3x week)',        o: 'CEO', t: 'L', tip: '' },
      { l: 'Execution\nBankers (2x)', o: 'CEO', t: 'N', tip: '' },
      { l: 'Account\nExec. (2x)',     o: 'CEO', t: 'N', tip: '' },
      { l: 'Senior\nBanker (1x)',     o: 'CEO', t: 'N', tip: '' },
      { l: 'Ashar\nFull Time',        o: 'CEO', t: 'L', tip: '' },
      { l: 'Office\nSpace',           o: 'CEO', t: 'L', tip: '' },
    ],
  },
  'Founder Discipline': {
    center: 'Founder\nDiscipline',
    cells: [
      { l: 'Physical Rec.\n(3x week)',    o: 'All', t: 'L', tip: '' },
      { l: 'In Person\n(1 / Qtr)',        o: 'CEO', t: 'L', tip: '' },
      { l: 'Workflow\n(1 / Qtr)',         o: 'All', t: 'L', tip: '' },
      { l: 'Annual\nOffsite',             o: 'CEO', t: 'L', tip: '' },
      { l: 'Comms\nDiscipline',           o: 'All', t: 'L', tip: '' },
      { l: 'Quarterly\nHorada Review',    o: 'CEO', t: 'L', tip: '' },
      { l: 'Non – Work\nCall (1x Week)',  o: 'CEO', t: 'L', tip: '' },
      { l: 'Network. Event\n(3 / Qtr)',   o: 'All', t: 'L', tip: '' },
    ],
  },
  'M&A Process': {
    center: 'M&A\nProcess',
    cells: [
      { l: 'Qualification\nEngine',       o: 'CTO', t: 'N', tip: '' },
      { l: 'Deal\nDiagnostics',           o: 'CEO', t: 'N', tip: '' },
      { l: 'Database\nFrontend',          o: 'CTO', t: 'L', tip: '' },
      { l: 'Deal\nPortal',                o: 'CTO', t: 'N', tip: '' },
      { l: 'Deal\nPlaybook',              o: 'CEO', t: 'L', tip: '' },
      { l: 'Limited Execution\nfrom Yash',o: 'CTO', t: 'N', tip: '' },
      { l: 'First Close\nby Q2 2027',     o: 'CEO', t: 'L', tip: '' },
      { l: 'Buyer Outreach\nAutomat.',    o: 'CTO', t: 'L', tip: '' },
    ],
  },
  'Tech': {
    center: 'Tech',
    cells: [
      { l: 'Qualification\nEngine',    o: 'CTO', t: 'N', tip: '' },
      { l: 'Precedent\nTool',          o: 'CTO', t: 'L', tip: '' },
      { l: 'Database\nFrontend',       o: 'CTO', t: 'L', tip: '' },
      { l: 'Content\nGenerat.',        o: 'CTO', t: 'N', tip: '' },
      { l: 'Cold Engage.\n(20%)',       o: 'CTO', t: 'L', tip: '' },
      { l: 'BD Workflow\n(2-3x)',       o: 'CTO', t: 'N', tip: '' },
      { l: 'Buyer Outreach\nAutomat.', o: 'CTO', t: 'L', tip: '' },
      { l: 'M&A Workflow\n(2-3x)',      o: 'CTO', t: 'L', tip: '' },
    ],
  },
  'Brand': {
    center: 'Brand',
    cells: [
      { l: 'Precedent\nTool',          o: 'CTO', t: 'L', tip: '' },
      { l: 'Speaking Engage.\n(3x Year)',o: 'Pres', t: 'L', tip: '' },
      { l: 'Company\nLinkedin (1k)',    o: 'CEO',  t: 'L', tip: '' },
      { l: 'Founders\nLinkedin (5k)',   o: 'All',  t: 'L', tip: '' },
      { l: 'Award',                    o: 'Pres', t: 'L', tip: '' },
      { l: 'Elan Events\n(5x Year)',    o: 'Pres', t: 'L', tip: '' },
      { l: 'Press\nCoverage',          o: 'Pres', t: 'L', tip: '' },
      { l: 'Case\nStudies',            o: 'CEO',  t: 'L', tip: '' },
    ],
  },
  'Referral Network': {
    center: 'Mandate\nPipeline',
    cells: [
      { l: 'Referral\nDatabase',          o: 'Pres', t: 'L', tip: 'Track every referral given and received — networks die without reciprocity' },
      { l: 'Elan Events\n(5x Year)',       o: 'Pres', t: 'L', tip: '' },
      { l: 'Cold Engage.\n(20%)',          o: 'CTO',  t: 'L', tip: '' },
      { l: 'Existing Seller\nInbound (1x Year)', o: 'Pres', t: 'N', tip: '' },
      { l: 'Industry Events\n(5x Year)',   o: 'Pres', t: 'L', tip: '' },
      { l: 'Qualification\nEngine',        o: 'CTO',  t: 'N', tip: '' },
      { l: 'GTM Lead',                     o: 'CEO',  t: 'N', tip: '' },
      { l: 'Account\nExec. (2x)',          o: 'CEO',  t: 'N', tip: '' },
    ],
  },
  'Buyer Network': {
    center: 'Buyers',
    cells: [
      { l: 'Buyer Outreach\nAutomat.',            o: 'CTO',  t: 'L', tip: '' },
      { l: 'Database\nFrontend',                  o: 'CTO',  t: 'L', tip: '' },
      { l: 'Motion for PEs to\nUnderstand Criteria', o: 'Pres', t: 'L', tip: 'Funds receive deals they cannot do — be their trusted redirect' },
      { l: 'Industry Events\n(5x Year)',           o: 'Pres', t: 'L', tip: '' },
      { l: 'Buyer Mandates\n(2-3x Yr)',            o: 'Pres', t: 'L', tip: 'Every buyer should know your deal criteria in one sentence' },
      { l: 'Quarterly Sector\nNewsletter',         o: 'CTO',  t: 'N', tip: 'Send buyers a short market update to stay top of mind without selling' },
      { l: 'Precedent\nTool',                      o: 'CTO',  t: 'L', tip: '' },
      { l: 'Buyer Mandate\nPlaybook',              o: 'CEO',  t: 'L', tip: '' },
    ],
  },
  'Pipeline': {
    center: 'Partners /\nReferrals',
    cells: [
      { l: 'New Partner\n(1x Year)',       o: 'Pres', t: 'L', tip: '' },
      { l: 'Academia',                     o: 'CTO',  t: 'L', tip: '' },
      { l: 'Existing Seller\nInbound (1x Year)', o: 'Pres', t: 'N', tip: '' },
      { l: 'Elan Events\n(5x Year)',       o: 'Pres', t: 'L', tip: 'One targeted industry event per quarter to re-activate warm ties' },
      { l: 'Memberships\n(1x Year)',       o: 'Pres', t: 'N', tip: '' },
      { l: 'Referral\nDatabase',           o: 'Pres', t: 'L', tip: '' },
      { l: 'Cold Motion\nfor Partners',    o: 'CTO',  t: 'L', tip: '' },
      { l: 'Automated Linkedin\nEngage.',  o: 'CTO',  t: 'N', tip: '' },
    ],
  },
};
