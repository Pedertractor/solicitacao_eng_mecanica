import 'dotenv/config';
import { $Enums } from '../src/generated/prisma/client.js';
import { HttpError } from '../src/https/errors/index.js';
import { prisma } from '../src/lib/prisma.js';
import { UserService } from '../src/services/user-service.js';

const SEED_CARD_NUMBER = '5487';
const SEED_UNIT = $Enums.Unit.PEDERTRACTOR;

async function seedAdminUser() {
  console.log(
    `Seed: registrando cartão ${SEED_CARD_NUMBER} na unidade ${SEED_UNIT} via API corporativa.`,
  );

  const userService = new UserService();

  try {
    const user = await userService.register({
      cardNumber: SEED_CARD_NUMBER,
      unit: SEED_UNIT,
      active: true,
      role: $Enums.UserRole.ADMIN,
    });
    console.log(
      `Seed: usuário criado (${user.name}, cartão ${user.cardNumber}, unidade ${user.unit}, role ${user.role}, senha inicial = cartão).`,
    );
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.statusCode === 400 && e.message === 'Usuário já existe') {
        console.log(
          `Seed: usuário ${SEED_CARD_NUMBER}/${SEED_UNIT} já existe; ignorando.`,
        );
        return;
      }
      console.error(
        `Seed: falha ao registrar ${SEED_CARD_NUMBER} (${e.statusCode}): ${e.message}`,
      );
      throw e;
    }
    throw e;
  }
}

async function main() {
  await seedAdminUser();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
