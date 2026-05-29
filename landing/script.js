const cards = Array.from(document.querySelectorAll('.screenshot-card'));
const dots = Array.from(document.querySelectorAll('.dots button'));
const controls = Array.from(document.querySelectorAll('.carousel-button'));
let activeIndex = 0;

function setActive(index) {
  activeIndex = (index + cards.length) % cards.length;
  cards.forEach((card, cardIndex) => {
    card.classList.toggle('is-active', cardIndex === activeIndex);
  });
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle('is-active', dotIndex === activeIndex);
  });
}

controls.forEach((button) => {
  button.addEventListener('click', () => {
    setActive(activeIndex + Number(button.dataset.direction || 1));
  });
});

dots.forEach((dot, index) => {
  dot.addEventListener('click', () => setActive(index));
});

window.setInterval(() => {
  setActive(activeIndex + 1);
}, 6000);
