import readline from "readline";
import { generateTestVideo, EncodingType } from "./ffmpeg";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const questionAsync = (query: string) => {
  return new Promise<string>((resolve) => {
    rl.question(query, resolve);
  });
};

const main = async () => {
  console.log("Testing software encoder: ");
  await generateTestVideo(EncodingType.CPU).catch(console.error);

  const answer = await questionAsync(
    "Would you like to test other hardware encoders? (yes/no): ",
  );

  if (answer.toLowerCase() === "yes") {
    const encoder = await questionAsync(
      "Which hardware encoder would you like to test? (INTEL/NVIDIA/AMD/APPLE): ",
    );
    let selectedEncoder: EncodingType;

    switch (encoder.toUpperCase()) {
      case "INTEL":
        selectedEncoder = EncodingType.INTEL;
        break;
      case "NVIDIA":
        selectedEncoder = EncodingType.NVIDIA;
        break;
      case "AMD":
        selectedEncoder = EncodingType.AMD;
        break;
      case "APPLE":
        selectedEncoder = EncodingType.APPLE;
        break;
      default:
        console.log("Invalid choice. Exiting.");
        rl.close();
        return;
    }

    console.log(`Testing ${selectedEncoder} encoder:`);
    await generateTestVideo(selectedEncoder).catch(console.error);
  } else {
    console.log("Exiting.");
  }

  rl.close();
};

main().catch((err) => {
  console.error("An error occurred:", err);
  rl.close();
});
