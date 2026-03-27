document.querySelectorAll('.mainHeading .line').forEach(el => {
    el.innerHTML = el.textContent.split('').map(char =>
        char === ' ' ? ' ' : `<span class="char">${char}</span>`
    ).join('');
});