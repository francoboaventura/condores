const ESCUDO = import.meta.env.BASE_URL + 'escudo.png'

// O link público antigo (.../condores/#/votacao) agora só avisa que a votação é pelo app, com login
export default function Votacao() {
  const irParaApp = () => { location.hash = '' }
  return (
    <div className="app votacao">
      <header>
        <img src={ESCUDO} alt="Condores" />
        <h1>ATLETA MAIS CONDORES<small>Votação do time</small></h1>
      </header>
      <main>
        <section className="voto-fim">
          <div className="tr">🏆</div>
          <h2>A votação agora é pelo app</h2>
          <p>Entre com o seu nome e a sua senha. A votação aparece logo depois de você conferir seus dados.</p>
          <button className="btn" onClick={irParaApp}>Entrar no app</button>
        </section>
      </main>
    </div>
  )
}
