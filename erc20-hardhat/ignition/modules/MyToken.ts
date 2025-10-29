// ignition/modules/TokenModule.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  // Use the account as the token owner
  const owner = m.getAccount(0);
  // Mint to account (change as you like)
  const recipient = m.getAccount(0);

  // Deploy MyToken with the owner passed to the constructor
  const token = m.contract("MyToken", [owner]);

  // Mint 5 tokens (18 decimals) to `recipient` as the owner
  m.call(
    token,
    "mint",
    [recipient, 5n * 10n ** 18n],
    { from: owner }
  );

  return { token };
});
