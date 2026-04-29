/**
 * Translation script — adds comments section i18n keys to all locales
 * Uses Node.js fs (no PowerShell) to write UTF-8 without BOM
 */
const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '..', 'messages');

const translations = {
  comments: {
    title: { en: "Comments", es: "Comentarios", fr: "Commentaires", de: "Kommentare", pt: "Comentários", ar: "التعليقات", zh: "评论", hi: "टिप्पणियाँ", ja: "コメント", ko: "댓글", ru: "Комментарии" },
    joinPrompt: { en: "Create a free account to join the conversation", es: "Crea una cuenta gratuita para unirte a la conversación", fr: "Créez un compte gratuit pour rejoindre la conversation", de: "Erstelle ein kostenloses Konto, um mitzudiskutieren", pt: "Crie uma conta gratuita para participar da conversa", ar: "أنشئ حسابًا مجانيًا للانضمام إلى المحادثة", zh: "创建免费账户参与讨论", hi: "बातचीत में शामिल होने के लिए एक मुफ़्त खाता बनाएँ", ja: "無料アカウントを作成して会話に参加", ko: "무료 계정을 만들어 대화에 참여하세요", ru: "Создайте бесплатный аккаунт, чтобы присоединиться к обсуждению" },
    createAccount: { en: "Create Account", es: "Crear Cuenta", fr: "Créer un Compte", de: "Konto Erstellen", pt: "Criar Conta", ar: "إنشاء حساب", zh: "创建账户", hi: "खाता बनाएँ", ja: "アカウント作成", ko: "계정 만들기", ru: "Создать Аккаунт" },
    loading: { en: "Loading comments...", es: "Cargando comentarios...", fr: "Chargement des commentaires...", de: "Kommentare laden...", pt: "Carregando comentários...", ar: "جاري تحميل التعليقات...", zh: "加载评论中...", hi: "टिप्पणियाँ लोड हो रही हैं...", ja: "コメントを読み込み中...", ko: "댓글 불러오는 중...", ru: "Загрузка комментариев..." },
    beFirst: { en: "Be the first to comment ✨", es: "Sé el primero en comentar ✨", fr: "Soyez le premier à commenter ✨", de: "Schreibe den ersten Kommentar ✨", pt: "Seja o primeiro a comentar ✨", ar: "كن أول من يعلق ✨", zh: "成为第一个评论者 ✨", hi: "सबसे पहले टिप्पणी करें ✨", ja: "最初にコメントしましょう ✨", ko: "첫 댓글을 남겨보세요 ✨", ru: "Оставьте первый комментарий ✨" },
    loadMore: { en: "Load more comments", es: "Cargar más comentarios", fr: "Charger plus de commentaires", de: "Mehr Kommentare laden", pt: "Carregar mais comentários", ar: "تحميل المزيد من التعليقات", zh: "加载更多评论", hi: "और टिप्पणियाँ लोड करें", ja: "さらにコメントを読み込む", ko: "댓글 더 보기", ru: "Загрузить ещё" },
    placeholder: { en: "Share your thoughts...", es: "Comparte tus pensamientos...", fr: "Partagez vos pensées...", de: "Teilen Sie Ihre Gedanken...", pt: "Compartilhe seus pensamentos...", ar: "شارك أفكارك...", zh: "分享你的想法...", hi: "अपने विचार साझा करें...", ja: "あなたの感想を書いてください...", ko: "생각을 공유하세요...", ru: "Поделитесь своими мыслями..." },
    cancel: { en: "Cancel", es: "Cancelar", fr: "Annuler", de: "Abbrechen", pt: "Cancelar", ar: "إلغاء", zh: "取消", hi: "रद्द करें", ja: "キャンセル", ko: "취소", ru: "Отмена" },
    reply: { en: "Reply", es: "Responder", fr: "Répondre", de: "Antworten", pt: "Responder", ar: "رد", zh: "回复", hi: "उत्तर दें", ja: "返信", ko: "답글", ru: "Ответить" },
    post: { en: "Post", es: "Publicar", fr: "Publier", de: "Posten", pt: "Publicar", ar: "نشر", zh: "发布", hi: "पोस्ट", ja: "投稿", ko: "게시", ru: "Опубликовать" },
    failedPost: { en: "Failed to post comment", es: "Error al publicar el comentario", fr: "Échec de la publication du commentaire", de: "Kommentar konnte nicht veröffentlicht werden", pt: "Erro ao publicar comentário", ar: "فشل نشر التعليق", zh: "发布评论失败", hi: "टिप्पणी पोस्ट करने में विफल", ja: "コメントの投稿に失敗しました", ko: "댓글 게시 실패", ru: "Не удалось опубликовать комментарий" },
    justNow: { en: "just now", es: "justo ahora", fr: "à l'instant", de: "gerade eben", pt: "agora mesmo", ar: "الآن", zh: "刚刚", hi: "अभी", ja: "たった今", ko: "방금", ru: "только что" },
    mAgo: { en: "{n}m ago", es: "hace {n}m", fr: "il y a {n}m", de: "vor {n}m", pt: "há {n}m", ar: "منذ {n}د", zh: "{n}分钟前", hi: "{n}मि पहले", ja: "{n}分前", ko: "{n}분 전", ru: "{n}м назад" },
    hAgo: { en: "{n}h ago", es: "hace {n}h", fr: "il y a {n}h", de: "vor {n}h", pt: "há {n}h", ar: "منذ {n}س", zh: "{n}小时前", hi: "{n}घंटे पहले", ja: "{n}時間前", ko: "{n}시간 전", ru: "{n}ч назад" },
    dAgo: { en: "{n}d ago", es: "hace {n}d", fr: "il y a {n}j", de: "vor {n}T", pt: "há {n}d", ar: "منذ {n}ي", zh: "{n}天前", hi: "{n}दिन पहले", ja: "{n}日前", ko: "{n}일 전", ru: "{n}д назад" },
    edited: { en: "(edited)", es: "(editado)", fr: "(modifié)", de: "(bearbeitet)", pt: "(editado)", ar: "(معدّل)", zh: "(已编辑)", hi: "(संपादित)", ja: "(編集済み)", ko: "(수정됨)", ru: "(изменено)" },
    pinned: { en: "Pinned", es: "Fijado", fr: "Épinglé", de: "Angeheftet", pt: "Fixado", ar: "مثبت", zh: "置顶", hi: "पिन किया गया", ja: "ピン留め", ko: "고정됨", ru: "Закреплено" },
    flagged: { en: "Flagged", es: "Marcado", fr: "Signalé", de: "Markiert", pt: "Sinalizado", ar: "مُبلغ عنه", zh: "已标记", hi: "चिह्नित", ja: "フラグ付き", ko: "신고됨", ru: "Отмечено" },
    save: { en: "Save", es: "Guardar", fr: "Enregistrer", de: "Speichern", pt: "Salvar", ar: "حفظ", zh: "保存", hi: "सहेजें", ja: "保存", ko: "저장", ru: "Сохранить" },
    editMinsLeft: { en: "Edit ({n}m left)", es: "Editar ({n}m restantes)", fr: "Modifier ({n}m restantes)", de: "Bearbeiten ({n}m übrig)", pt: "Editar ({n}m restantes)", ar: "تعديل ({n}د متبقية)", zh: "编辑（剩余{n}分钟）", hi: "संपादित करें ({n}मि शेष)", ja: "編集（残り{n}分）", ko: "수정 ({n}분 남음)", ru: "Редактировать ({n}м осталось)" },
    editWindowClosed: { en: "Edit window closed", es: "Período de edición cerrado", fr: "Délai de modification expiré", de: "Bearbeitungsfenster geschlossen", pt: "Período de edição encerrado", ar: "انتهت فترة التعديل", zh: "编辑时间已过", hi: "संपादन समय समाप्त", ja: "編集期間が終了しました", ko: "수정 기간 종료", ru: "Время редактирования истекло" },
    delete: { en: "Delete", es: "Eliminar", fr: "Supprimer", de: "Löschen", pt: "Excluir", ar: "حذف", zh: "删除", hi: "हटाएँ", ja: "削除", ko: "삭제", ru: "Удалить" },
    deleteConfirm: { en: "Delete this comment?", es: "¿Eliminar este comentario?", fr: "Supprimer ce commentaire ?", de: "Diesen Kommentar löschen?", pt: "Excluir este comentário?", ar: "حذف هذا التعليق؟", zh: "删除此评论？", hi: "यह टिप्पणी हटाएँ?", ja: "このコメントを削除しますか？", ko: "이 댓글을 삭제하시겠습니까?", ru: "Удалить этот комментарий?" },
    hide: { en: "Hide", es: "Ocultar", fr: "Masquer", de: "Ausblenden", pt: "Ocultar", ar: "إخفاء", zh: "隐藏", hi: "छिपाएँ", ja: "非表示", ko: "숨기기", ru: "Скрыть" },
    unhide: { en: "Unhide", es: "Mostrar", fr: "Afficher", de: "Einblenden", pt: "Mostrar", ar: "إظهار", zh: "取消隐藏", hi: "दिखाएँ", ja: "表示する", ko: "숨기기 취소", ru: "Показать" },
    pin: { en: "Pin", es: "Fijar", fr: "Épingler", de: "Anheften", pt: "Fixar", ar: "تثبيت", zh: "置顶", hi: "पिन करें", ja: "ピン留め", ko: "고정", ru: "Закрепить" },
    unpin: { en: "Unpin", es: "Desfijar", fr: "Détacher", de: "Lösen", pt: "Desfixar", ar: "إلغاء التثبيت", zh: "取消置顶", hi: "अनपिन करें", ja: "ピン解除", ko: "고정 해제", ru: "Открепить" },
    deletedComment: { en: "This comment has been deleted", es: "Este comentario ha sido eliminado", fr: "Ce commentaire a été supprimé", de: "Dieser Kommentar wurde gelöscht", pt: "Este comentário foi excluído", ar: "تم حذف هذا التعليق", zh: "此评论已被删除", hi: "यह टिप्पणी हटा दी गई है", ja: "このコメントは削除されました", ko: "이 댓글은 삭제되었습니다", ru: "Этот комментарий был удалён" },
    removedByMod: { en: "This comment has been removed by a moderator", es: "Este comentario ha sido eliminado por un moderador", fr: "Ce commentaire a été supprimé par un modérateur", de: "Dieser Kommentar wurde von einem Moderator entfernt", pt: "Este comentário foi removido por um moderador", ar: "تمت إزالة هذا التعليق من قبل مشرف", zh: "此评论已被管理员移除", hi: "यह टिप्पणी एक मॉडरेटर द्वारा हटा दी गई है", ja: "このコメントはモデレーターによって削除されました", ko: "이 댓글은 관리자에 의해 삭제되었습니다", ru: "Этот комментарий был удалён модератором" },
    replyTo: { en: "Reply to {name}...", es: "Responder a {name}...", fr: "Répondre à {name}...", de: "Antwort an {name}...", pt: "Responder para {name}...", ar: "الرد على {name}...", zh: "回复 {name}...", hi: "{name} को उत्तर दें...", ja: "{name}に返信...", ko: "{name}에게 답글...", ru: "Ответить {name}..." },
  }
};

const locales = ['en', 'es', 'fr', 'de', 'pt', 'ar', 'zh', 'hi', 'ja', 'ko', 'ru'];

for (const locale of locales) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);

  let changed = false;

  for (const [section, keys] of Object.entries(translations)) {
    if (!json[section]) {
      json[section] = {};
    }
    for (const [key, vals] of Object.entries(keys)) {
      if (!json[section][key]) {
        json[section][key] = vals[locale] || vals.en;
        changed = true;
        console.log(`  [ADD] ${locale}: ${section}.${key}`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    console.log(`✅ Updated ${locale}.json`);
  } else {
    console.log(`⏭ ${locale}.json — no changes needed`);
  }
}

console.log('\nDone!');
