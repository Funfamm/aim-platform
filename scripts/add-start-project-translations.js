const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'messages');

const translations = {
  en: {
    startProject: {
      hero: { title: "Let's Create Something Unforgettable", subtitle: "Tell us what you want to create — from birthday videos to commercials, branding, and custom productions.", cta: "Start Your Project" },
      steps: { projectType: "Choose Project", contact: "Your Details", overview: "Project Overview", creative: "Creative Direction", dynamic: "Project Details", uploads: "Add Files", delivery: "Budget & Delivery", review: "Review & Submit" },
      projectTypes: {
        birthday: { title: "Birthday / Celebration", description: "Personalized videos for birthdays, milestones, and family moments." },
        brand: { title: "Brand / Business", description: "Professional visuals for your business, product, or service." },
        commercial: { title: "Commercial / Ad", description: "Ad-ready content for campaigns, promotions, and launches." },
        music: { title: "Music / Creative Visual", description: "Visual storytelling for songs, lyrics, and creative performances." },
        film: { title: "Short Film / Story", description: "Story-driven video concepts, scenes, and cinematic ideas." },
        event: { title: "Event / Promo", description: "Promotional content for upcoming events and announcements." },
        custom: { title: "Custom Project", description: "Tell us what you need and we will shape the right creative approach." }
      },
      fields: {
        projectType: "Project Type", clientName: "Full Name", email: "Email", phone: "Phone / WhatsApp", contactMethod: "Preferred Contact Method", companyName: "Company Name",
        projectTitle: "Project Title", description: "Describe your project", deadline: "Deadline or Event Date", audience: "Target Audience", projectGoal: "Project Goal",
        tone: "Tone / Style", visualStyle: "Visual Style", inspirationLinks: "Inspiration Links", avoidNotes: "Anything to avoid?", emotionalFeeling: "Desired emotional feeling",
        budgetRange: "Budget Range", duration: "Desired Duration", aspectRatio: "Aspect Ratio", deliveryPlatform: "Delivery Platform", addOns: "Add-ons", uploads: "Upload Files"
      },
      tones: { cinematic: "Cinematic", emotional: "Emotional", fun: "Fun", luxury: "Luxury", kidsFriendly: "Kids-friendly", bold: "Bold", inspirational: "Inspirational", cleanMinimal: "Clean / Minimal", dramatic: "Dramatic", professional: "Professional" },
      budgetOptions: { "30-50": "$30–$50", "50-100": "$50–$100", "100-250": "$100–$250", "250-500": "$250–$500", "500+": "$500+", "not-sure": "Not sure yet" },
      aspectOptions: { "16:9": "16:9 YouTube", "9:16": "9:16 TikTok/Reels", "1:1": "1:1 Square", multiple: "Multiple formats", "not-sure": "Not sure" },
      addonOptions: { voiceover: "Voice-over", subtitles: "Subtitles", translation: "Translation", multipleVersions: "Multiple versions", thumbnail: "Thumbnail/Poster", rushDelivery: "Rush delivery" },
      buttons: { back: "Back", continue: "Continue", review: "Review Request", submit: "Submit Project Request", submitAnother: "Submit Another Project", returnHome: "Return Home", edit: "Edit" },
      confirmation: { title: "Your Project Has Been Received", subtitle: "We received your brief and will review your request.", projectId: "Project ID", nextSteps: "What happens next", step1: "We review your submission", step2: "We confirm scope and timeline", step3: "Production begins" },
      statuses: { received: "Received", reviewing: "Under Review", scope_confirmed: "Scope Confirmed", in_production: "In Production", awaiting_client: "Awaiting Client", delivered: "Delivered", completed: "Completed", cancelled: "Cancelled" },
      validation: { required: "This field is required", email: "Please enter a valid email address", fileTooLarge: "This file is too large", unsupportedFile: "This file type is not supported", descriptionMin: "Please describe your project (min 10 characters)", consentRequired: "You must agree to be contacted", maxFiles: "Maximum 10 files allowed" },
      consent: { uploadPermission: "I confirm I have permission to share the uploaded content.", contactAgreement: "I agree to be contacted about this project request." },
      helpers: { overviewHint: "Tell us what you want to create. Keep it simple — we will refine it with you.", uploadHint: "Add photos, videos, logos, music, or reference files that help us understand your vision.", uploading: "Uploading...", uploadTypes: "Images, videos, audio, PDF, ZIP", remaining: "remaining", filesUploaded: "files uploaded" },
      dynamicFields: {
        celebrantName: "Celebrant name", ageTurning: "Age turning", relationship: "Relationship to celebrant", eventDate: "Event date", favoriteColors: "Favorite colors", favoriteCharacters: "Favorite characters / hobbies", messageToInclude: "Message to include", preferredMood: "Preferred mood",
        brandName: "Brand name", industry: "Industry", website: "Website", socialLinks: "Social media links", brandColors: "Brand colors", mainMessage: "Main message", targetAudience: "Target audience", desiredCTA: "Desired CTA",
        productName: "Product or service name", campaignGoal: "Campaign goal", platform: "Platform", videoDuration: "Video duration", offer: "Offer / promotion", cta: "Call to action", scriptReady: "Script ready?", competitorLinks: "Competitor/reference links",
        songName: "Song name", artistName: "Artist name", mood: "Mood", lyricsSyncRequired: "Lyrics sync required?", storyline: "Storyline", performanceOrCinematic: "Performance or cinematic?",
        storyTitle: "Story title", genre: "Genre", synopsis: "Synopsis", mainCharacters: "Main characters", runtimeTarget: "Runtime target", dialogueRequired: "Dialogue required?", mustHaveScenes: "Must-have scenes", visualTone: "Visual tone",
        eventName: "Event name", venue: "Venue/location", promoGoal: "Purpose of promo", speakers: "Speakers/hosts", importantDetails: "Important event details",
        requestDescription: "Describe your request", whatIsThisFor: "What is this for?", desiredResult: "What result should it achieve?", requiredDeliverables: "Required deliverables", specialNotes: "Special notes"
      }
    }
  },
  es: {
    startProject: {
      hero: { title: "Creemos Algo Inolvidable", subtitle: "Cuéntanos qué quieres crear — desde videos de cumpleaños hasta comerciales, branding y producciones personalizadas.", cta: "Iniciar Tu Proyecto" },
      steps: { projectType: "Tipo de Proyecto", contact: "Tus Datos", overview: "Resumen", creative: "Dirección Creativa", dynamic: "Detalles", uploads: "Archivos", delivery: "Presupuesto", review: "Revisar" },
      projectTypes: {
        birthday: { title: "Cumpleaños / Celebración", description: "Videos personalizados para cumpleaños, hitos y momentos familiares." },
        brand: { title: "Marca / Negocio", description: "Visuales profesionales para tu negocio, producto o servicio." },
        commercial: { title: "Comercial / Anuncio", description: "Contenido listo para campañas, promociones y lanzamientos." },
        music: { title: "Música / Visual Creativo", description: "Narrativa visual para canciones, letras y actuaciones." },
        film: { title: "Cortometraje / Historia", description: "Conceptos de video narrativos, escenas e ideas cinematográficas." },
        event: { title: "Evento / Promo", description: "Contenido promocional para eventos y anuncios." },
        custom: { title: "Proyecto Personalizado", description: "Cuéntanos lo que necesitas y diseñaremos el enfoque creativo." }
      },
      fields: { projectType: "Tipo de Proyecto", clientName: "Nombre Completo", email: "Correo Electrónico", phone: "Teléfono / WhatsApp", contactMethod: "Método de Contacto", companyName: "Empresa", projectTitle: "Título del Proyecto", description: "Describe tu proyecto", deadline: "Fecha Límite", audience: "Público Objetivo", projectGoal: "Objetivo", tone: "Tono / Estilo", visualStyle: "Estilo Visual", inspirationLinks: "Enlaces de Inspiración", avoidNotes: "¿Algo que evitar?", emotionalFeeling: "Sentimiento deseado", budgetRange: "Rango de Presupuesto", duration: "Duración Deseada", aspectRatio: "Relación de Aspecto", deliveryPlatform: "Plataforma de Entrega", addOns: "Complementos", uploads: "Subir Archivos" },
      tones: { cinematic: "Cinematográfico", emotional: "Emocional", fun: "Divertido", luxury: "Lujo", kidsFriendly: "Para niños", bold: "Audaz", inspirational: "Inspirador", cleanMinimal: "Limpio / Minimalista", dramatic: "Dramático", professional: "Profesional" },
      budgetOptions: { "30-50": "$30–$50", "50-100": "$50–$100", "100-250": "$100–$250", "250-500": "$250–$500", "500+": "$500+", "not-sure": "No estoy seguro" },
      aspectOptions: { "16:9": "16:9 YouTube", "9:16": "9:16 TikTok/Reels", "1:1": "1:1 Cuadrado", multiple: "Múltiples formatos", "not-sure": "No estoy seguro" },
      addonOptions: { voiceover: "Voz en off", subtitles: "Subtítulos", translation: "Traducción", multipleVersions: "Múltiples versiones", thumbnail: "Miniatura/Póster", rushDelivery: "Entrega urgente" },
      buttons: { back: "Atrás", continue: "Continuar", review: "Revisar", submit: "Enviar Solicitud", submitAnother: "Enviar Otro Proyecto", returnHome: "Volver al Inicio", edit: "Editar" },
      confirmation: { title: "Tu Proyecto Ha Sido Recibido", subtitle: "Recibimos tu solicitud y la revisaremos pronto.", projectId: "ID del Proyecto", nextSteps: "¿Qué sigue?", step1: "Revisamos tu solicitud", step2: "Confirmamos alcance y plazos", step3: "Comienza la producción" },
      statuses: { received: "Recibido", reviewing: "En Revisión", scope_confirmed: "Alcance Confirmado", in_production: "En Producción", awaiting_client: "Esperando Cliente", delivered: "Entregado", completed: "Completado", cancelled: "Cancelado" },
      validation: { required: "Este campo es obligatorio", email: "Ingresa un correo válido", fileTooLarge: "Este archivo es muy grande", unsupportedFile: "Tipo de archivo no soportado", descriptionMin: "Describe tu proyecto (mín. 10 caracteres)", consentRequired: "Debes aceptar ser contactado", maxFiles: "Máximo 10 archivos permitidos" },
      consent: { uploadPermission: "Confirmo que tengo permiso para compartir el contenido subido.", contactAgreement: "Acepto ser contactado sobre esta solicitud de proyecto." },
      helpers: { overviewHint: "Cuéntanos lo que quieres crear. Mantenlo simple — lo perfeccionaremos contigo.", uploadHint: "Agrega fotos, videos, logos, música o archivos de referencia.", uploading: "Subiendo...", uploadTypes: "Imágenes, videos, audio, PDF, ZIP", remaining: "restantes", filesUploaded: "archivos subidos" },
      dynamicFields: { celebrantName: "Nombre del festejado", ageTurning: "Edad que cumple", relationship: "Relación", eventDate: "Fecha del evento", favoriteColors: "Colores favoritos", favoriteCharacters: "Personajes / hobbies favoritos", messageToInclude: "Mensaje a incluir", preferredMood: "Ambiente preferido", brandName: "Nombre de marca", industry: "Industria", website: "Sitio web", socialLinks: "Redes sociales", brandColors: "Colores de marca", mainMessage: "Mensaje principal", targetAudience: "Público objetivo", desiredCTA: "CTA deseado", productName: "Nombre del producto", campaignGoal: "Objetivo de campaña", platform: "Plataforma", videoDuration: "Duración del video", offer: "Oferta / promoción", cta: "Llamada a la acción", scriptReady: "¿Guión listo?", competitorLinks: "Enlaces de competencia", songName: "Nombre de la canción", artistName: "Nombre del artista", mood: "Ambiente", lyricsSyncRequired: "¿Sincronización de letras?", storyline: "Argumento", performanceOrCinematic: "¿Actuación o cinemático?", storyTitle: "Título de la historia", genre: "Género", synopsis: "Sinopsis", mainCharacters: "Personajes principales", runtimeTarget: "Duración objetivo", dialogueRequired: "¿Diálogos requeridos?", mustHaveScenes: "Escenas imprescindibles", visualTone: "Tono visual", eventName: "Nombre del evento", venue: "Lugar/ubicación", promoGoal: "Propósito del promo", speakers: "Ponentes/conductores", importantDetails: "Detalles importantes", requestDescription: "Describe tu solicitud", whatIsThisFor: "¿Para qué es esto?", desiredResult: "¿Qué resultado esperas?", requiredDeliverables: "Entregables requeridos", specialNotes: "Notas especiales" }
    }
  },
  fr: {
    startProject: {
      hero: { title: "Créons Quelque Chose d'Inoubliable", subtitle: "Dites-nous ce que vous souhaitez créer — des vidéos d'anniversaire aux publicités, branding et productions personnalisées.", cta: "Démarrer Votre Projet" },
      steps: { projectType: "Type de Projet", contact: "Vos Coordonnées", overview: "Aperçu", creative: "Direction Créative", dynamic: "Détails", uploads: "Fichiers", delivery: "Budget", review: "Vérifier" },
      projectTypes: { birthday: { title: "Anniversaire / Célébration", description: "Vidéos personnalisées pour anniversaires et moments familiaux." }, brand: { title: "Marque / Entreprise", description: "Visuels professionnels pour votre entreprise." }, commercial: { title: "Publicité / Annonce", description: "Contenu prêt pour les campagnes et lancements." }, music: { title: "Musique / Visuel Créatif", description: "Narration visuelle pour chansons et performances." }, film: { title: "Court Métrage / Histoire", description: "Concepts vidéo narratifs et idées cinématiques." }, event: { title: "Événement / Promo", description: "Contenu promotionnel pour événements." }, custom: { title: "Projet Sur Mesure", description: "Dites-nous ce dont vous avez besoin." } },
      fields: { projectType: "Type de Projet", clientName: "Nom Complet", email: "E-mail", phone: "Téléphone / WhatsApp", contactMethod: "Méthode de Contact", companyName: "Entreprise", projectTitle: "Titre du Projet", description: "Décrivez votre projet", deadline: "Date Limite", audience: "Public Cible", projectGoal: "Objectif", tone: "Ton / Style", visualStyle: "Style Visuel", inspirationLinks: "Liens d'Inspiration", avoidNotes: "Choses à éviter?", emotionalFeeling: "Émotion souhaitée", budgetRange: "Budget", duration: "Durée Souhaitée", aspectRatio: "Format", deliveryPlatform: "Plateforme", addOns: "Options", uploads: "Téléverser" },
      tones: { cinematic: "Cinématique", emotional: "Émotionnel", fun: "Amusant", luxury: "Luxe", kidsFriendly: "Pour enfants", bold: "Audacieux", inspirational: "Inspirant", cleanMinimal: "Épuré / Minimal", dramatic: "Dramatique", professional: "Professionnel" },
      budgetOptions: { "30-50": "30–50 $", "50-100": "50–100 $", "100-250": "100–250 $", "250-500": "250–500 $", "500+": "500+ $", "not-sure": "Pas encore sûr" },
      aspectOptions: { "16:9": "16:9 YouTube", "9:16": "9:16 TikTok/Reels", "1:1": "1:1 Carré", multiple: "Formats multiples", "not-sure": "Pas sûr" },
      addonOptions: { voiceover: "Voix off", subtitles: "Sous-titres", translation: "Traduction", multipleVersions: "Versions multiples", thumbnail: "Miniature/Affiche", rushDelivery: "Livraison urgente" },
      buttons: { back: "Retour", continue: "Continuer", review: "Vérifier", submit: "Soumettre la Demande", submitAnother: "Soumettre un Autre", returnHome: "Retour à l'Accueil", edit: "Modifier" },
      confirmation: { title: "Votre Projet a Été Reçu", subtitle: "Nous avons reçu votre brief et examinerons votre demande.", projectId: "ID du Projet", nextSteps: "Prochaines étapes", step1: "Nous examinons votre demande", step2: "Nous confirmons la portée", step3: "La production commence" },
      statuses: { received: "Reçu", reviewing: "En Examen", scope_confirmed: "Portée Confirmée", in_production: "En Production", awaiting_client: "En Attente", delivered: "Livré", completed: "Terminé", cancelled: "Annulé" },
      validation: { required: "Ce champ est requis", email: "Entrez un e-mail valide", fileTooLarge: "Fichier trop volumineux", unsupportedFile: "Type de fichier non supporté", descriptionMin: "Décrivez votre projet (min 10 caractères)", consentRequired: "Vous devez accepter d'être contacté", maxFiles: "Maximum 10 fichiers" },
      consent: { uploadPermission: "Je confirme avoir le droit de partager le contenu.", contactAgreement: "J'accepte d'être contacté concernant ce projet." },
      helpers: { overviewHint: "Dites-nous ce que vous souhaitez créer.", uploadHint: "Ajoutez des photos, vidéos, logos ou fichiers de référence.", uploading: "Téléversement...", uploadTypes: "Images, vidéos, audio, PDF, ZIP", remaining: "restants", filesUploaded: "fichiers téléversés" },
      dynamicFields: { celebrantName: "Nom du célébré", ageTurning: "Âge", relationship: "Relation", eventDate: "Date", favoriteColors: "Couleurs préférées", favoriteCharacters: "Personnages / hobbies", messageToInclude: "Message à inclure", preferredMood: "Ambiance", brandName: "Nom de marque", industry: "Industrie", website: "Site web", socialLinks: "Réseaux sociaux", brandColors: "Couleurs de marque", mainMessage: "Message principal", targetAudience: "Public cible", desiredCTA: "CTA souhaité", productName: "Nom du produit", campaignGoal: "Objectif de campagne", platform: "Plateforme", videoDuration: "Durée vidéo", offer: "Offre / promotion", cta: "Appel à l'action", scriptReady: "Script prêt?", competitorLinks: "Liens concurrents", songName: "Nom de la chanson", artistName: "Nom de l'artiste", mood: "Ambiance", lyricsSyncRequired: "Sync des paroles?", storyline: "Scénario", performanceOrCinematic: "Performance ou ciné?", storyTitle: "Titre", genre: "Genre", synopsis: "Synopsis", mainCharacters: "Personnages", runtimeTarget: "Durée cible", dialogueRequired: "Dialogues requis?", mustHaveScenes: "Scènes indispensables", visualTone: "Ton visuel", eventName: "Nom de l'événement", venue: "Lieu", promoGoal: "But du promo", speakers: "Intervenants", importantDetails: "Détails importants", requestDescription: "Décrivez votre demande", whatIsThisFor: "À quoi sert-ce?", desiredResult: "Résultat souhaité?", requiredDeliverables: "Livrables requis", specialNotes: "Notes spéciales" }
    }
  }
};

// For remaining locales, clone English with locale code marker
const remaining = { ar: 'العربية', hi: 'हिन्दी', pt: 'Português', zh: '中文', ja: '日本語', de: 'Deutsch', ru: 'Русский', ko: '한국어' };

// Deep clone EN as base for untranslated locales (they'll show English labels — better than crashing)
for (const [locale] of Object.entries(remaining)) {
  translations[locale] = JSON.parse(JSON.stringify(translations.en));
}

// Inject into each locale file
for (const [locale, newKeys] of Object.entries(translations)) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) { console.log(`Skipping ${locale} — file not found`); continue; }

  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);

  // Merge startProject namespace
  json.startProject = newKeys.startProject;

  const output = JSON.stringify(json, null, 2);
  fs.writeFileSync(filePath, output, { encoding: 'utf-8' });
  console.log(`Updated ${locale}`);
}

console.log('Done!');
