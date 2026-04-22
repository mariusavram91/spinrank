import { setAvatarImage } from "../../../src/ui/shared/utils/avatar";

describe("avatar utils", () => {
  it("renders a deterministic initial avatar when avatar url is missing", () => {
    const imageA = document.createElement("img");
    const imageB = document.createElement("img");

    setAvatarImage(imageA, "user_1", null, "/assets/logo.svg", "Ada avatar", "Ada Lovelace");
    setAvatarImage(imageB, "user_2", null, "/assets/logo.svg", "Ada avatar", "Ada Lovelace");

    expect(imageA.src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(imageA.src).toBe(imageB.src);
    expect(decodeURIComponent(imageA.src.slice("data:image/svg+xml,".length))).toContain(">A<");
  });

  it("falls back to the default avatar when display name is missing", () => {
    const image = document.createElement("img");

    setAvatarImage(image, "user_1", null, "/assets/logo.svg", "User avatar");

    expect(image.src.endsWith("/assets/logo.svg")).toBe(true);
  });

  it("uses the backend avatar proxy when configured", () => {
    const image = document.createElement("img");

    setAvatarImage(
      image,
      "user_1",
      "https://avatars.example.test/user_1.png",
      "/assets/logo.svg",
      "User avatar",
      "Ada",
    );

    expect(image.src.endsWith("/avatar/user_1")).toBe(true);
  });
});
