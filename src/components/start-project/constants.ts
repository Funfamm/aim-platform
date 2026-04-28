/** All dynamic fields per project type (renders the full field list). */
export const TYPE_FIELDS: Record<string, string[]> = {
    birthday:   ['celebrantName', 'ageTurning', 'relationship', 'eventDate', 'favoriteColors', 'favoriteCharacters', 'messageToInclude', 'preferredMood'],
    brand:      ['brandName', 'industry', 'website', 'socialLinks', 'brandColors', 'mainMessage', 'targetAudience', 'desiredCTA'],
    commercial: ['productName', 'campaignGoal', 'platform', 'videoDuration', 'offer', 'cta', 'scriptReady', 'competitorLinks'],
    music:      ['songName', 'artistName', 'mood', 'lyricsSyncRequired', 'storyline', 'visualStyle', 'performanceOrCinematic'],
    film:       ['storyTitle', 'genre', 'synopsis', 'mainCharacters', 'runtimeTarget', 'dialogueRequired', 'mustHaveScenes', 'visualTone'],
    event:      ['eventName', 'eventDate', 'venue', 'promoGoal', 'speakers', 'cta', 'importantDetails'],
    custom:     ['requestDescription', 'whatIsThisFor', 'desiredResult', 'requiredDeliverables', 'specialNotes'],
}

/** First 2 fields per type are always mandatory. */
export const REQUIRED_DYNAMIC: Record<string, string[]> = {
    birthday:   ['celebrantName', 'ageTurning'],
    brand:      ['brandName', 'industry'],
    commercial: ['productName', 'campaignGoal'],
    music:      ['songName', 'artistName'],
    film:       ['storyTitle', 'genre'],
    event:      ['eventName', 'eventDate'],
    custom:     ['requestDescription', 'whatIsThisFor'],
}

/** Project type card metadata. */
export const PROJECT_TYPES = [
    { id: 'birthday', icon: '🎉', gradient: 'rgba(249,115,22,0.12)' },
    { id: 'brand',    icon: '🏢', gradient: 'rgba(59,130,246,0.12)' },
    { id: 'commercial', icon: '📺', gradient: 'rgba(6,182,212,0.12)' },
    { id: 'music',    icon: '🎵', gradient: 'rgba(168,85,247,0.12)' },
    { id: 'film',     icon: '🎬', gradient: 'rgba(239,68,68,0.12)' },
    { id: 'event',    icon: '📣', gradient: 'rgba(245,158,11,0.12)' },
    { id: 'custom',   icon: '✨', gradient: 'rgba(212,168,83,0.12)' },
]

/** Budget range options. */
export const BUDGET_OPTIONS = ['30-50', '50-100', '100-250', '250-500', '500+', 'not-sure']

/** Aspect ratio options. */
export const ASPECT_OPTIONS = ['16:9', '9:16', '1:1', 'multiple', 'not-sure']

/** Add-on options. */
export const ADDON_OPTIONS = ['voiceover', 'subtitles', 'translation', 'multipleVersions', 'thumbnail', 'rushDelivery']

/** Tone options for creative direction. */
export const TONE_OPTIONS = [
    'cinematic', 'emotional', 'fun', 'luxury', 'kidsFriendly',
    'bold', 'inspirational', 'cleanMinimal', 'dramatic', 'professional',
]
export const MAX_TONES = 3

/** Visual style options. */
export const VISUAL_STYLE_OPTIONS = [
    'realistic', 'animated', 'motionGraphics', 'documentary',
    'vintage', 'neon', 'blackAndWhite', 'abstract', 'corporate',
]

/** Fields that benefit from textarea. */
export const LONG_FIELDS = new Set([
    'synopsis', 'storyline', 'messageToInclude', 'mainCharacters',
    'mustHaveScenes', 'importantDetails', 'requestDescription',
    'desiredResult', 'requiredDeliverables', 'specialNotes',
    'socialLinks', 'competitorLinks',
])

/** Fields that should use a date picker. */
export const DATE_FIELDS = new Set(['eventDate'])

/** Upload limits. */
export const MAX_FILES = 10
export const MAX_VIDEO_MB = 500
export const MAX_AUDIO_MB = 50
export const MAX_OTHER_MB = 10
