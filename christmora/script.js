const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let questionCount = 0;
let selectedPhotos = [];
let currentGift = null;
let lastGeneratedLink = "";


// =====================================
// PAGE NAVIGATION
// =====================================

function hideAllPages() {
  document.getElementById("homePage").classList.add("hidden");
  document.getElementById("creatorPage").classList.add("hidden");
  document.getElementById("linkPage").classList.add("hidden");
  document.getElementById("recipientPage").classList.add("hidden");
  document.getElementById("errorPage").classList.add("hidden");
}

function showCreator() {
  hideAllPages();
  document.getElementById("creatorPage").classList.remove("hidden");

  if (questionCount === 0) {
    addQuestion();
  }
}

function goHome() {
  hideAllPages();
  document.getElementById("homePage").classList.remove("hidden");
}

function showError() {
  hideAllPages();
  document.getElementById("errorPage").classList.remove("hidden");
}


// =====================================
// QUIZ CREATOR
// =====================================

function addQuestion() {
  if (questionCount >= APP_CONFIG.maxQuestions) {
    alert("You can only add up to 10 questions.");
    return;
  }

  questionCount++;

  const number = questionCount;

  const card = document.createElement("div");
  card.className = "question-card";
  card.id = "questionCard" + number;

  card.innerHTML = `
    <h3>Question ${number}</h3>

    <input type="text" class="questionText"
      placeholder="Write your question">

    <input type="text" class="optionA"
      placeholder="Option A">

    <input type="text" class="optionB"
      placeholder="Option B">

    <input type="text" class="optionC"
      placeholder="Option C">

    <label class="correct-label">Correct Answer</label>

    <select class="correctAnswer">
      <option value="0">Option A</option>
      <option value="1">Option B</option>
      <option value="2">Option C</option>
    </select>
  `;

  document.getElementById("quizCreator").appendChild(card);
}


// =====================================
// PHOTO PREVIEW
// =====================================

document.getElementById("photoInput").addEventListener("change", function(event) {
  const files = Array.from(event.target.files);

  for (let file of files) {
    if (selectedPhotos.length >= 10) {
      alert("You can only upload up to 10 photos.");
      break;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Please use JPG, PNG, or WEBP photos.");
      continue;
    }

    if (file.size > APP_CONFIG.maxPhotoSize) {
      alert(file.name + " is larger than 10 MB.");
      continue;
    }

    selectedPhotos.push(file);
  }

  event.target.value = "";
  showPhotoPreview();
});

function showPhotoPreview() {
  const preview = document.getElementById("photoPreview");

  preview.innerHTML = "";

  selectedPhotos.forEach(function(file, index) {
    const imageURL = URL.createObjectURL(file);

    const item = document.createElement("div");
    item.className = "photo-item";

    const image = document.createElement("img");
    image.src = imageURL;
    image.alt = "Photo preview";

    const name = document.createElement("p");
    name.textContent = file.name;

    const removeButton = document.createElement("button");
    removeButton.className = "btn secondary";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", function() {
      removePhoto(index);
    });

    item.appendChild(image);
    item.appendChild(name);
    item.appendChild(removeButton);

    preview.appendChild(item);
  });
}

function removePhoto(index) {
  selectedPhotos.splice(index, 1);
  showPhotoPreview();
}


// =====================================
// COLLECT QUIZ DATA
// =====================================

function collectQuiz() {
  const cards = document.querySelectorAll(".question-card");
  const quiz = [];

  for (let card of cards) {
    const question = card.querySelector(".questionText").value.trim();

    const options = [
      card.querySelector(".optionA").value.trim(),
      card.querySelector(".optionB").value.trim(),
      card.querySelector(".optionC").value.trim()
    ];

    const correctAnswer = Number(
      card.querySelector(".correctAnswer").value
    );

    if (!question || options.some(option => option === "")) {
      throw new Error("Please complete every quiz question and answer.");
    }

    quiz.push({
      question: question,
      options: options,
      correctAnswer: correctAnswer
    });
  }

  return quiz;
}


// =====================================
// UPLOAD PHOTOS TO SUPABASE
// =====================================

async function uploadPhotos(giftID) {
  const memories = [];

  for (let i = 0; i < selectedPhotos.length; i++) {
    const file = selectedPhotos[i];

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath =
      giftID + "/" + Date.now() + "-" + i + "-" + safeName;

    const { error } = await db.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (error) {
      throw new Error("Photo upload failed: " + error.message);
    }

    const { data } = db.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    memories.push({
      url: data.publicUrl,
      name: file.name
    });
  }

  return memories;
}


// =====================================
// CREATE GIFT
// =====================================

async function createGift() {
  const button = document.getElementById("createGiftButton");
  const message = document.getElementById("creatorMessage");

  const sender = document.getElementById("senderInput").value.trim();
  const recipient = document.getElementById("recipientInput").value.trim();
  const greeting = document.getElementById("greetingInput").value.trim();
  const letterTitle = document.getElementById("letterTitleInput").value.trim();
  const letter = document.getElementById("letterInput").value.trim();

  if (!sender || !recipient || !letter) {
    alert("Please complete your name, recipient's name, and letter.");
    return;
  }

  let quiz;

  try {
    quiz = collectQuiz();
  } catch (error) {
    alert(error.message);
    return;
  }

  button.disabled = true;
  button.textContent = "Creating your gift...";
  message.textContent = "";

  try {
    const giftID = crypto.randomUUID();

    const memories = await uploadPhotos(giftID);

    const giftData = {
      id: giftID,
      sender: sender,
      recipient: recipient,
      greeting: greeting || "Merry Christmas!",
      letter_title: letterTitle || "A Letter for You",
      letter: letter,
      memories: memories,
      quiz: quiz
    };

    const { error } = await db
      .from("gifts")
      .insert(giftData);

    if (error) {
      throw error;
    }

    lastGeneratedLink =
      window.location.origin +
      window.location.pathname +
      "?gift=" + giftID;

    document.getElementById("generatedLink").textContent =
      lastGeneratedLink;

    hideAllPages();
    document.getElementById("linkPage").classList.remove("hidden");

  } catch (error) {
    console.error(error);
    message.textContent = "Something went wrong: " + error.message;
    message.className = "message";

  } finally {
    button.disabled = false;
    button.textContent = "Create My Gift";
  }
}


// =====================================
// COPY GIFT LINK
// =====================================

async function copyGiftLink() {
  try {
    await navigator.clipboard.writeText(lastGeneratedLink);
    alert("Gift link copied!");
  } catch (error) {
    alert("Unable to copy. Please copy the link manually.");
  }
}


// =====================================
// LOAD RECIPIENT GIFT
// =====================================

async function loadGift(giftID) {
  hideAllPages();

  try {
    const { data, error } = await db
      .from("gifts")
      .select("*")
      .eq("id", giftID)
      .single();

    if (error || !data) {
      showError();
      return;
    }

    currentGift = data;
    showRecipientGift();

  } catch (error) {
    console.error(error);
    showError();
  }
}


// =====================================
// DISPLAY RECIPIENT PAGE
// =====================================

function showRecipientGift() {
  hideAllPages();

  document.getElementById("recipientPage").classList.remove("hidden");

  document.getElementById("recipientGreeting").textContent =
    currentGift.greeting || "Merry Christmas!";

  document.getElementById("recipientIntro").textContent =
    "A special Christmas gift from " + currentGift.sender +
    " to " + currentGift.recipient + ".";

  document.getElementById("recipientLetterTitle").textContent =
    currentGift.letter_title || "A Letter for You";

  document.getElementById("recipientLetterGreeting").textContent =
    "Dear " + currentGift.recipient + ",";

  document.getElementById("recipientLetter").textContent =
    currentGift.letter;

  showRecipientPhotos();
  showRecipientQuiz();
}


// =====================================
// OPEN LETTER
// =====================================

function openLetter() {
  document.getElementById("letterSection").classList.toggle("hidden");
}


// =====================================
// OPEN MEMORY GALLERY
// =====================================

function openMemories() {
  const memories = currentGift.memories || [];

  if (memories.length === 0) {
    alert("There are no photos in this gift yet.");
    return;
  }

  document.getElementById("memorySection").classList.toggle("hidden");
}


// =====================================
// DISPLAY PHOTOS
// =====================================

function showRecipientPhotos() {
  const gallery = document.getElementById("recipientPhotos");

  gallery.innerHTML = "";

  const memories = currentGift.memories || [];

  if (memories.length === 0) {
    document.getElementById("memorySection").classList.add("hidden");
    return;
  }

  memories.forEach(function(memory) {
    const item = document.createElement("div");
    item.className = "photo-item";

    const image = document.createElement("img");
    image.src = memory.url;
    image.alt = "A shared memory";

    item.appendChild(image);
    gallery.appendChild(item);
  });
}


// =====================================
// DISPLAY QUIZ
// =====================================

function showRecipientQuiz() {
  const container = document.getElementById("quizQuestions");

  container.innerHTML = "";

  const quiz = currentGift.quiz || [];

  quiz.forEach(function(question, index) {
    const card = document.createElement("div");
    card.className = "question-card";

    const title = document.createElement("h3");
    title.textContent =
      "Question " + (index + 1) + ": " + question.question;

    card.appendChild(title);

    question.options.forEach(function(option, optionIndex) {
      const label = document.createElement("label");
      label.className = "quiz-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "quiz" + index;
      radio.value = optionIndex;

      label.appendChild(radio);
      label.appendChild(document.createTextNode(option));

      card.appendChild(label);
    });

    container.appendChild(card);
  });
}

function openQuiz() {
  document.getElementById("quizSection").classList.toggle("hidden");
}


// =====================================
// SUBMIT QUIZ
// =====================================

function submitQuiz() {
  const quiz = currentGift.quiz || [];
  let score = 0;

  if (quiz.length === 0) {
    document.getElementById("quizResult").textContent =
      "There are no questions in this quiz.";
    return;
  }

  for (let i = 0; i < quiz.length; i++) {
    const answer = document.querySelector(
      'input[name="quiz' + i + '"]:checked'
    );

    if (!answer) {
      alert("Please answer all questions first.");
      return;
    }

    if (Number(answer.value) === quiz[i].correctAnswer) {
      score++;
    }
  }

  const result = document.getElementById("quizResult");

  result.className = "message";
  result.textContent =
    "You got " + score + " out of " + quiz.length +
    " questions correct! 🎄";
}


// =====================================
// CHECK URL WHEN WEBSITE OPENS
// =====================================

async function checkPage() {
  const params = new URLSearchParams(window.location.search);
  const giftID = params.get("gift");

  if (giftID) {
    await loadGift(giftID);
  } else {
    goHome();
  }
}

checkPage();