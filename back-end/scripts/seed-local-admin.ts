import 'dotenv/config';
import bcrypt from 'bcrypt';
import {
  BOOTSTRAP_SUPER_ADMIN_CARD,
  BOOTSTRAP_SUPER_ADMIN_DEPARTMENT,
  BOOTSTRAP_SUPER_ADMIN_ROLE,
  BOOTSTRAP_SUPER_ADMIN_UNIT,
} from '../src/auth/bootstrap-super-admin.js';
import { $Enums } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const passwordHash = await bcrypt.hash(BOOTSTRAP_SUPER_ADMIN_CARD, 10);

  const user = await prisma.user.upsert({
    where: {
      cardNumber_unit: {
        cardNumber: BOOTSTRAP_SUPER_ADMIN_CARD,
        unit: BOOTSTRAP_SUPER_ADMIN_UNIT,
      },
    },
    create: {
      name: 'Admin Local',
      employeeId: `local-${BOOTSTRAP_SUPER_ADMIN_CARD}`,
      unit: BOOTSTRAP_SUPER_ADMIN_UNIT,
      cardNumber: BOOTSTRAP_SUPER_ADMIN_CARD,
      role: BOOTSTRAP_SUPER_ADMIN_ROLE,
      department: BOOTSTRAP_SUPER_ADMIN_DEPARTMENT,
      approvalStatus: $Enums.UserApprovalStatus.APPROVED,
      active: true,
      passwordHash,
      mustChangePassword: false,
    },
    update: {
      role: BOOTSTRAP_SUPER_ADMIN_ROLE,
      department: BOOTSTRAP_SUPER_ADMIN_DEPARTMENT,
      approvalStatus: $Enums.UserApprovalStatus.APPROVED,
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
