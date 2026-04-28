# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # Updated to latest stable for pnpm support
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.pnpm
  ];
  # Sets environment variables in the workspace
  env = {
    # You can add global env vars here if needed
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "dsznajder.es7-react-js-snippets"
      "dbaeumer.vscode-eslint"
      "esbenp.prettier-vscode"
      "bradlc.vscode-tailwindcss"
    ];
    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["pnpm" "run" "dev:web"];
          manager = "web";
          env = {
            PORT = "3015";
          };
        };
        api = {
          command = ["pnpm" "run" "dev:api"];
          manager = "web";
          env = {
            PORT = "3006";
          };
        };
      };
    };
    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        pnpm-install = "pnpm install";
      };
      # Runs when a workspace is (re)started
      onStart = {
        # Optional: run something every time the workspace starts
      };
    };
  };
}
