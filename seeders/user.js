import { faker, simpleFaker } from "@faker-js/faker";
import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
const createUser = async (numUsers) => {
  try {
    const userPromise = [];

    for (let i = 0; i < numUsers; i++) {
      const tempUser = User.create({
        name: faker.person.fullName(),
        username: faker.person.fullName(),
        bio: faker.lorem.sentence(10),
        password: "password",
        avatar: {
          url: faker.image.avatar(),
          public_id: faker.system.fileName(),
        },
      });
      userPromise.push(tempUser);
    }
    await Promise.all(userPromise);
    // console.log("Users created ", numUsers);
    process.exit(1);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};


export { createUser};
