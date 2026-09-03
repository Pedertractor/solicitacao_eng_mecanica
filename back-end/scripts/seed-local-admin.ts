import 'dotenv/config';
import bcrypt from 'bcrypt';
import { $Enums } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';

const CARD = '5487';
const UNIT = $Enums.Unit.PEDERTRACTOR;

async function main() {
  const passwordHash = await bcrypt.hash(CARD, 10);

  const user = await prisma.user.upsert({
    where: {
      cardNumber_unit: {
        cardNumber: CARD,
        unit: UNIT,
      },
    },
    create: {
      name: 'Admin Local',
      employeeId: `local-${CARD}`,
      unit: UNIT,
      cardNumber: CARD,
      role: $Enums.UserRole.ADMIN,
      active: true,
      passwordHash,
      mustChangePassword: false,
    },
    update: {
      role: $Enums.UserRole.ADMIN,
      active: true,
      passwordHash,
      mustChangePassword: false,
      name: 'Admin Local',
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        cardNumber: user.cardNumber,
        unit: user.unit,
        role: user.role,
        passwordHint: 'igual ao cartão',
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
