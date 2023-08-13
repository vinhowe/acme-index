// src/lib/katex-utils.ts
import katex from 'katex';
import type { KatexOptions } from 'katex';

type Delimiter = {
	left: string;
	right: string;
	display: boolean;
};

type DataType = 'text' | 'math';

type DataItem = {
	type: DataType;
	data: string;
	rawData?: string;
	display?: boolean;
};

type Options = {
	delimiters: Delimiter[];
	errorCallback: (message: string, error: Error) => void;
	macros: Record<string, string>;
};

function findEndOfMath(delimiter: string, text: string, startIndex: number): number {
	let index = startIndex;
	let braceLevel = 0;
	const delimLength = delimiter.length;

	while (index < text.length) {
		const character = text[index];

		if (braceLevel <= 0 && text.slice(index, index + delimLength) === delimiter) {
			return index;
		} else if (character === '\\') {
			index++;
		} else if (character === '{') {
			braceLevel++;
		} else if (character === '}') {
			braceLevel--;
		}

		index++;
	}

	return -1;
}

function escapeRegex(string: string): string {
	return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function splitAtDelimiters(text: string, delimiters: Delimiter[]): DataItem[] {
	let index;
	const data: DataItem[] = [];
	const regexLeft = new RegExp('(' + delimiters.map((x) => escapeRegex(x.left)).join('|') + ')');

	for (;;) {
		index = text.search(regexLeft);

		if (index === -1) {
			break;
		}

		if (index > 0) {
			data.push({
				type: 'text',
				data: text.slice(0, index)
			});
			text = text.slice(index);
		}

		const i = delimiters.findIndex((delim) => text.startsWith(delim.left));
		index = findEndOfMath(delimiters[i].right, text, delimiters[i].left.length);

		if (index === -1) {
			break;
		}

		const rawData = text.slice(0, index + delimiters[i].right.length);
		const math = text.slice(delimiters[i].left.length, index);
		data.push({
			type: 'math',
			data: math,
			rawData,
			display: delimiters[i].display
		});
		text = text.slice(index + delimiters[i].right.length);
	}

	if (text !== '') {
		data.push({
			type: 'text',
			data: text
		});
	}

	return data;
}

export function renderMathInString(text: string, options?: KatexOptions & Options): string {
	const defaultOptions: Options = {
		delimiters: [
			{ left: '$$', right: '$$', display: true },
			{ left: '$', right: '$', display: false },
			{ left: '\\(', right: '\\)', display: false },
			{ left: '\\begin{equation}', right: '\\end{equation}', display: true },
			{ left: '\\begin{align}', right: '\\end{align}', display: true },
			{ left: '\\begin{alignat}', right: '\\end{alignat}', display: true },
			{ left: '\\begin{gather}', right: '\\end{gather}', display: true },
			{ left: '\\begin{CD}', right: '\\end{CD}', display: true },
			{ left: '\\[', right: '\\]', display: true }
		],
		errorCallback: console.error,
		macros: {}
	};

	options = { ...defaultOptions, ...(options || {}) };

	const { delimiters } = options;
	const data = splitAtDelimiters(text, delimiters);

	return data
		.map((item) => {
			if (item.type === 'text') {
				return item.data;
			} else {
				try {
					const katexHtml = katex.renderToString(item.data, {
						displayMode: item.display,
						...options
					});
					if (item.display) {
						return `<span class="katex-display-wrapper">${katexHtml}</span>`;
					}
					return katexHtml;
				} catch (e) {
					if (e instanceof katex.ParseError && options?.errorCallback) {
						options.errorCallback(
							'KaTeX auto-render: Failed to parse `' + item.data + '` with ',
							e
						);
						return item.rawData;
					}
					throw e;
				}
			}
		})
		.join('');
}
