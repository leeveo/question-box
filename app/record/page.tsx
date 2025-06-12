import VideoRecorder from './components/VideoRecorder'

export default function RecordPage() {
  // Liste des questions à afficher
  const questions = [
    "Quel est votre parcours professionnel ?",
    "Quelles sont vos principales compétences techniques ?",
    "Parlez-nous d'un défi que vous avez surmonté récemment.",
    "Où vous voyez-vous dans 5 ans ?",
    "Quelle est votre plus grande réalisation professionnelle ?"
  ];

  return (
    <div 
      className="min-h-screen w-full flex flex-col justify-center items-center"
      style={{
        backgroundImage: 'url("/tf1.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundColor: '#000',
        position: 'relative'
      }}
    >
      {/* Overlay semi-transparent pour améliorer la lisibilité */}
      <div 
        className="absolute inset-0 bg-black/20"
        style={{ position: 'fixed', zIndex: 0 }}
      ></div>
      
      {/* Contenu principal - centré verticalement et horizontalement */}
      <div className="w-full max-w-4xl relative z-10 px-4">
        <h1 className="text-3xl font-bold mb-8 text-white text-center drop-shadow-lg">
          Enregistrez votre vidéo
        </h1>
        <VideoRecorder questions={questions} />
      </div>
    </div>
  );
}
