// Contact details shared by /terms/, /privacy/ and /takedown/.
/** Private address for takedown notices and privacy requests; null = the GitHub form is the only route. */
export const LEGAL_EMAIL: string | null = null;
/** DMCA designated agent as registered at dmca.copyright.gov (17 U.S.C. 512(c)(2)); null until registered. */
export const DESIGNATED_AGENT: { name: string; address: string; phone?: string; email: string; directory: string } | null = null;
export const TAKEDOWN_FORM = 'https://github.com/andrewnakas/recompsoftware/issues/new?template=takedown.yml';
/** Date the policies were last changed, shown on each page. */
export const POLICY_DATE = '2026-11-04';
