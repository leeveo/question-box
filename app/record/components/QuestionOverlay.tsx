interface QuestionOverlayProps {
  questionText: string;
  currentIndex: number;
  totalQuestions: number;
}

export default function QuestionOverlay({ 
  questionText, 
  currentIndex, 
  totalQuestions 
}: QuestionOverlayProps) {
  return (
    <div className="bg-black/40 backdrop-blur-md text-white p-4 rounded-lg w-full max-w-xl border border-white/30 shadow-lg">
      <div className="flex items-center mb-2">
        <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3">
          {currentIndex + 1}
        </div>
        <h3 className="text-sm font-bold">Question {currentIndex + 1}/{totalQuestions}</h3>
      </div>
      <div className="border-t border-white/20 pt-2 mt-1">
        <p className="text-lg font-medium">{questionText}</p>
      </div>
    </div>
  );
}
