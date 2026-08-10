import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Link } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

export type InternalLinkKind = 'checkpoint' | 'alternative' | 'route' | 'budget' | 'budget_item';

const INTERNAL_LINK_PREFIX = 'trip://';
const INTERNAL_LINK_KINDS: InternalLinkKind[] = [
  'checkpoint',
  'alternative',
  'route',
  'budget',
  'budget_item',
];

function parseInternalLink(href: string): { kind: InternalLinkKind; id: string } | null {
  if (!href.startsWith(INTERNAL_LINK_PREFIX)) return null;
  const [kind, id] = href.slice(INTERNAL_LINK_PREFIX.length).split('/');
  if (INTERNAL_LINK_KINDS.includes(kind as InternalLinkKind) && id) {
    return { kind: kind as InternalLinkKind, id };
  }
  return null;
}

interface Props {
  notes: string;
  variant?: 'body2' | 'caption';
  sx?: SxProps<Theme>;
  onInternalLink?(kind: InternalLinkKind, id: string): void;
}

export function MarkdownNotes({ notes, variant = 'body2', sx, onInternalLink }: Props) {
  return (
    <Box
      sx={[
        {
          typography: variant,
          color: 'text.secondary',
          '& p, & ul, & ol, & blockquote, & pre': { m: 0 },
          '& p + p': { mt: 0.5 },
          '& ul, & ol': { pl: 2.5 },
          '& code': { fontSize: '0.9em' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={
          onInternalLink
            ? (url) => (parseInternalLink(url) ? url : defaultUrlTransform(url))
            : undefined
        }
        components={{
          a: ({ node: _node, href, children }) => {
            const internal = href ? parseInternalLink(href) : null;
            if (internal && onInternalLink) {
              const handleClick = () => onInternalLink(internal.kind, internal.id);
              return (
                <Link component="button" type="button" onClick={handleClick}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {notes}
      </ReactMarkdown>
    </Box>
  );
}
