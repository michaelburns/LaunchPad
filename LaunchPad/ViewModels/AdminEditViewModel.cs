using LaunchPad.Models;
using System.Collections.Generic;

namespace LaunchPad.ViewModels
{
    public class AdminEditViewModel
    {
        public User User { get; set; }
        public IEnumerable<int> SelectedRoles { get; set; }
    }
}
