import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RepoFetcher from '@/components/RepoFetcher';

describe('RepoFetcher', () => {
  it('validates supported repository URLs', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<RepoFetcher onSubmit={onSubmit} state="idle" />);

    const input = screen.getByTestId('repo-url-input');
    fireEvent.change(input, { target: { value: 'https://invalid.example.com/foo/bar' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/only github, gitlab, or bitbucket/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
