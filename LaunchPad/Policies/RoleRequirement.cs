using Microsoft.AspNetCore.Authorization;

namespace LaunchPad.Policies
{
    public class RoleRequirement : IAuthorizationRequirement
    {
        public string Role { get; private set; }

        public RoleRequirement(string role)
        {
            Role = role;
        }
    }
}
