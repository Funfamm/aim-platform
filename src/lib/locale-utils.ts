/**
 * Infer the best UI locale from an ISO 3166-1 alpha-2 country code.
 *
 * When the subscriber's saved locale is still the default 'en' we look
 * at their country to guess a better locale. If they've already chosen
 * a non-English locale we respect that.
 *
 * Shared utility — used by subscriber-campaign, survey send, and any
 * future bulk-email route.
 */
export function inferLocaleFromCountry(country: string | null | undefined, savedLocale: string): string {
    if (savedLocale && savedLocale !== 'en') return savedLocale
    if (!country) return 'en'
    const map: Record<string, string> = {
        ES:'es',MX:'es',AR:'es',CO:'es',CL:'es',PE:'es',VE:'es',EC:'es',GT:'es',CU:'es',
        BO:'es',DO:'es',HN:'es',PY:'es',SV:'es',NI:'es',CR:'es',PA:'es',UY:'es',
        FR:'fr',BE:'fr',CH:'fr',CA:'fr',SN:'fr',CI:'fr',ML:'fr',BF:'fr',NE:'fr',GN:'fr',CD:'fr',MG:'fr',
        DE:'de',AT:'de',LI:'de',
        BR:'pt',PT:'pt',AO:'pt',MZ:'pt',
        CN:'zh',TW:'zh',HK:'zh',SG:'zh',
        JP:'ja',
        KR:'ko',
        RU:'ru',BY:'ru',KZ:'ru',
        SA:'ar',AE:'ar',EG:'ar',IQ:'ar',SY:'ar',JO:'ar',LB:'ar',LY:'ar',
        TN:'ar',MA:'ar',DZ:'ar',YE:'ar',SD:'ar',OM:'ar',KW:'ar',QA:'ar',BH:'ar',
    }
    return map[country.toUpperCase()] ?? 'en'
}
