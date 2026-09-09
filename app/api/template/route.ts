import { exampleInput } from '@/lib/example';
import { DEFAULT_RUBRIC } from '@/lib/eval';
export async function GET() {
  return Response.json(
    { ...exampleInput, rubric: DEFAULT_RUBRIC },
    {
      headers: {
        'Content-Disposition':
          'attachment; filename="duizhao-import-template.json"',
      },
    },
  );
}
