import changelogRaw from '../../../CHANGELOG.md?raw';
import { parseChangelog, type ChangelogVersao } from './changelog';

export const versoesDoApp: ChangelogVersao[] = parseChangelog(changelogRaw);
export const versaoAtual: string = versoesDoApp[0]?.versao ?? '';
