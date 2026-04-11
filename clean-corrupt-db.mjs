import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Searching for corrupted UserNotifications...')
  
  // The corruption happens when characters are interpreted as Latin-1 string sequences instead of UTF-8.
  // Common markers include 'ðŸ' (emojis), 'Ã' (accents), 'Ù' and 'Ø' (Arabic).
  const result = await prisma.userNotification.deleteMany({
    where: {
      OR: [
        { title: { contains: 'ðŸ' } },
        { title: { contains: 'Ã' } },
        { title: { contains: 'Ù' } },
        { title: { contains: 'Ø' } }
      ]
    }
  })
  
  console.log(`✅ Deleted ${result.count} corrupted notifications from the database.`)
  
  const emailLogResult = await prisma.emailLog.deleteMany({
     where: {
      OR: [
        { subject: { contains: 'ðŸ' } },
        { subject: { contains: 'Ã' } },
        { subject: { contains: 'Ù' } },
        { subject: { contains: 'Ø' } }
      ]
    }
  })
  console.log(`✅ Deleted ${emailLogResult.count} corrupted email logs.`)

}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
