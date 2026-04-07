import { marked } from 'marked';

function stripHtmlTags(value) {
  return String(value || '').replace(/<[^>]+>/g, '');
}

function joinParagraphs(parts) {
  return parts.filter(Boolean).join('\n\n');
}

function flattenInlineTokens(tokens = []) {
  return tokens.map((token) => {
    if (!token) return '';

    if (Array.isArray(token.tokens) && token.tokens.length) {
      switch (token.type) {
        case 'link':
          return flattenInlineTokens(token.tokens);
        case 'strong':
        case 'em':
        case 'del':
        case 'paragraph':
        case 'heading':
        case 'text':
          return flattenInlineTokens(token.tokens);
        default:
          break;
      }
    }

    switch (token.type) {
      case 'text':
      case 'escape':
        return token.text || token.raw || '';
      case 'codespan':
        return token.text || '';
      case 'br':
        return '\n';
      case 'link':
      case 'image':
        return token.text || token.href || '';
      case 'html':
        return stripHtmlTags(token.raw || token.text || '');
      default:
        return token.text || token.raw || '';
    }
  }).join('');
}

function flattenBlockToken(token) {
  if (!token) return '';

  switch (token.type) {
    case 'space':
      return '';
    case 'paragraph':
    case 'heading':
      return flattenInlineTokens(token.tokens || []);
    case 'text':
      return Array.isArray(token.tokens) && token.tokens.length
        ? flattenInlineTokens(token.tokens)
        : (token.text || token.raw || '');
    case 'blockquote':
      return flattenBlockTokens(token.tokens || []);
    case 'list':
      return token.items
        .map((item) => {
          const text = flattenBlockTokens(item.tokens || []).trim();
          if (!text) return '';
          return `- ${text.replace(/\n/g, '\n  ')}`;
        })
        .filter(Boolean)
        .join('\n');
    case 'code':
      return token.text || '';
    case 'table': {
      const rows = [];
      if (Array.isArray(token.header) && token.header.length) {
        rows.push(token.header.map((cell) => flattenInlineTokens(cell.tokens || [])).join(' | '));
      }
      if (Array.isArray(token.rows) && token.rows.length) {
        rows.push(...token.rows.map((row) =>
          row.map((cell) => flattenInlineTokens(cell.tokens || [])).join(' | ')
        ));
      }
      return rows.join('\n');
    }
    case 'hr':
      return '';
    case 'html':
      return stripHtmlTags(token.raw || token.text || '');
    default:
      if (Array.isArray(token.tokens) && token.tokens.length) {
        return flattenInlineTokens(token.tokens);
      }
      return token.text || token.raw || '';
  }
}

function flattenBlockTokens(tokens = []) {
  return joinParagraphs(tokens.map(flattenBlockToken).map((part) => String(part || '').trim()));
}

export function markdownToPlainTextPreview(input) {
  const source = String(input || '');
  if (!source) return '';

  try {
    const tokens = marked.lexer(source, { gfm: true, breaks: true });
    return flattenBlockTokens(tokens)
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return source
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
