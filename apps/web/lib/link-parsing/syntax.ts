const codes = {
  horizontalTab: -2,
  virtualSpace: -1,
  nul: 0,
  eof: null,
  space: 32
}

function markdownLineEndingOrSpace (code: number) {
  return code < codes.nul || code === codes.space
}

function markdownLineEnding (code: number) {
  return code < codes.horizontalTab
}

export const wikiLink = () =>{
  const startMarker = '[['
  const endMarker = ']]'

  const tokenize = (effects: any, ok: any, nok: any) => {
    var data = false;

    var startMarkerCursor = 0
    var endMarkerCursor = 0

    return start

    function start (code: number) {
      if (code !== startMarker.charCodeAt(startMarkerCursor)) return nok(code)

      effects.enter('wikiLink')
      effects.enter('wikiLinkMarker')

      return consumeStart(code)
    }

    function consumeStart (code: number) {
      if (startMarkerCursor === startMarker.length) {
        effects.exit('wikiLinkMarker')
        return consumeData(code)
      }

      if (code !== startMarker.charCodeAt(startMarkerCursor)) {
        return nok(code)
      }

      effects.consume(code)
      startMarkerCursor++

      return consumeStart
    }

    function consumeData (code: number) {
      if (markdownLineEnding(code) || code === codes.eof) {
        return nok(code)
      }

      effects.enter('wikiLinkData')
      effects.enter('wikiLinkTarget')
      return consumeTarget(code)
    }

    function consumeTarget (code: number) {
      if (code === endMarker.charCodeAt(endMarkerCursor)) {
        if (!data) return nok(code)
        effects.exit('wikiLinkTarget')
        effects.exit('wikiLinkData')
        effects.enter('wikiLinkMarker')
        return consumeEnd(code)
      }

      if (markdownLineEnding(code) || code === codes.eof) {
        return nok(code)
      }

      if (!markdownLineEndingOrSpace(code)) {
        data = true
      }

      effects.consume(code)

      return consumeTarget
    }

    function consumeEnd (code: number) {
      if (endMarkerCursor === endMarker.length) {
        effects.exit('wikiLinkMarker')
        effects.exit('wikiLink')
        return ok(code)
      }

      if (code !== endMarker.charCodeAt(endMarkerCursor)) {
        return nok(code)
      }

      effects.consume(code)
      endMarkerCursor++

      return consumeEnd
    }
  }

  var call = { tokenize: tokenize }

  return {
    text: { 91: call } // left square bracket
  }
}