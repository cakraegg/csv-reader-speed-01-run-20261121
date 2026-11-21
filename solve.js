// csv-reader-speed: a single-pass regex-scan drop-in for csv-reader 1.0.0.
//
// The reference reads one character at a time and grows every field a
// character at a time. This module answers exactly the same way, but it
// never walks character by character: each field is taken in whole slices
// between the few characters that can end or change it, found with a
// native regex scan, and the slices are joined with plain concatenation.
// Nothing is kept from one call to the next, nothing is random, and the
// only work per field is one regex search plus the slices it brackets.
//
// Answer shape: { columns, rows, errors } for an input { text, header }.
// A field ends 0 = at a comma, 1 = at a line break, 2 = at the end of text.

export function run(input) {
  const text = String(input.text);
  const useHeader = input.header === true;
  const total = text.length;

  const faults = []; // errors, in the order they are met
  const table = []; // records after the header (every record without one)
  let head = null; // first record, when there is a header
  let span = -1; // width every record is padded or cut to

  // Cursor and line tracking. A leading U+FEFF is dropped, nothing else.
  let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let lineno = 1;
  let startLine = 1; // line the record being read starts on
  let startRow = null; // its index in rows (null for the header)

  // The only two scans in the whole reader. Fresh per call, so no state
  // leaks between cases: plain fields stop at , CR or LF, quoted fields
  // stop at " CR or LF.
  const plainScan = /[,\r\n]/g;
  const quoteScan = /["\r\n]/g;

  function note(code) {
    faults.push({ code, line: startLine, row: startRow });
  }

  // Read an unquoted field, starting from text already owned in `seed`
  // ("" for a fresh field, the quoted part for junk after a closing
  // quote, or '"' when a quote turns out never to close). Returns
  // [value, endKind, kept], where kept counts only the characters this
  // call added, so the caller can tell junk from nothing. A CR not
  // followed by LF is dropped and faulted, never kept.
  function plain(seed) {
    let value = seed;
    let kept = 0;
    for (;;) {
      plainScan.lastIndex = cursor;
      const hit = plainScan.exec(text);
      if (hit === null) {
        if (cursor < total) {
          value += text.slice(cursor, total);
          kept += total - cursor;
        }
        cursor = total;
        return [value, 2, kept];
      }
      const at = hit.index;
      if (at > cursor) {
        value += text.slice(cursor, at);
        kept += at - cursor;
      }
      // Dispatch on the code unit, not on a one-character string, so the
      // common comma and line-break ends allocate nothing extra.
      const mark = text.charCodeAt(at);
      if (mark === 44) {
        cursor = at + 1;
        return [value, 0, kept];
      }
      if (mark === 10) {
        cursor = at + 1;
        lineno += 1;
        return [value, 1, kept];
      }
      // A lone CR: drop it, fault it, and keep reading the same field.
      if (text.charCodeAt(at + 1) === 10) {
        cursor = at + 2;
        lineno += 1;
        return [value, 1, kept];
      }
      note('stray_cr');
      cursor = at + 1;
    }
  }

  // Read a field that opens with a quote at the cursor. Inside, "" is
  // one quote and every CR, LF or CRLF is one LF (and one line). What
  // follows the closing quote up to the next comma or break is appended
  // as it stands, faulted as quote_junk when anything was kept. A quote
  // that never closes is a literal character and the text after it is
  // read again as unquoted, with the line count wound back first.
  function quoted() {
    const openAt = cursor;
    const openLine = lineno;
    cursor += 1;
    let value = '';
    for (;;) {
      quoteScan.lastIndex = cursor;
      const hit = quoteScan.exec(text);
      if (hit === null) {
        cursor = openAt + 1;
        lineno = openLine;
        note('unterminated_quote');
        return plain('"');
      }
      const at = hit.index;
      if (at > cursor) value += text.slice(cursor, at);
      const mark = text.charCodeAt(at);
      if (mark === 34) {
        if (text.charCodeAt(at + 1) === 34) {
          value += '"';
          cursor = at + 2;
          continue;
        }
        cursor = at + 1;
        if (cursor >= total) return [value, 2, 0];
        const next = text.charCodeAt(cursor);
        if (next === 44) {
          cursor += 1;
          return [value, 0, 0];
        }
        if (next === 10) {
          cursor += 1;
          lineno += 1;
          return [value, 1, 0];
        }
        if (next === 13 && text.charCodeAt(cursor + 1) === 10) {
          cursor += 2;
          lineno += 1;
          return [value, 1, 0];
        }
        const tail = plain(value);
        if (tail[2] > 0) note('quote_junk');
        return tail;
      }
      // CR (13) or LF (10) inside quotes: one LF in the value, one line.
      value += '\n';
      lineno += 1;
      cursor = mark === 13 && text.charCodeAt(at + 1) === 10 ? at + 2 : at + 1;
    }
  }

  for (;;) {
    // Lines left with no characters are no records: skip bare LF and CRLF.
    while (cursor < total) {
      const c = text.charCodeAt(cursor);
      if (c === 10) {
        cursor += 1;
        lineno += 1;
      } else if (c === 13 && text.charCodeAt(cursor + 1) === 10) {
        cursor += 2;
        lineno += 1;
      } else {
        break;
      }
    }
    if (cursor >= total) break;

    startLine = lineno;
    startRow = useHeader && head === null ? null : table.length;
    const fields = [];
    let lastQuoted = false;
    let endKind = 2;
    for (;;) {
      let piece;
      if (text.charCodeAt(cursor) === 34) {
        lastQuoted = true;
        piece = quoted();
      } else {
        lastQuoted = false;
        piece = plain('');
      }
      fields.push(piece[0]);
      endKind = piece[1];
      if (endKind !== 0) break;
    }

    // A line that held only stray CRs is left with no characters either:
    // no record, though its stray_cr faults stay.
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (span < 0) span = fields.length;
    if (useHeader && head === null) {
      head = fields;
      continue;
    }
    if (fields.length < span) {
      faults.push({ code: 'short_row', line: startLine, row: startRow, fields: fields.length });
      while (fields.length < span) fields.push('');
    } else if (fields.length > span) {
      faults.push({ code: 'long_row', line: startLine, row: startRow, extra: fields.splice(span) });
    }
    table.push(fields);
  }

  return { columns: useHeader ? (head ?? []) : null, rows: table, errors: faults };
}
