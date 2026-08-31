import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/routes/constants';

type AccessDeniedStateProps = {
  title: string;
  description: string;
  showHomeLink?: boolean;
};

export function AccessDeniedState({
  title,
  description,
  showHomeLink = false,
}: AccessDeniedStateProps) {
  const navigate = useNavigate();

  return (
    <div className='flex w-full justify-center py-10'>
      <Card className='max-w-2xl'>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription className='text-pretty wrap-break-word'>
            {description}
          </CardDescription>
        </CardHeader>
        {showHomeLink ? (
          <CardFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() =>
                navigate(ROUTES.HOME, { replace: true, state: null })
              }
            >
              Voltar ao início
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}
